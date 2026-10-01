import { TextUtils } from '../../core/text-utils';
import { VectorMath, toMatchPercentage } from '../../core/vector-math';
import type { EmbeddingRecord, IndexableEntityType } from '../../domain/entities/models';
import type { IEmbeddingRepository, IInteractionRepository } from '../../domain/repositories';
import type { IEmbeddingProvider } from '../../domain/services/ai-provider';
import type { EntityIndexRegistry } from './entity-index.registry';

export interface SemanticSearchOptions {
  types?: IndexableEntityType[];
  limit?: number;
  minScore?: number;
  userId?: string | null;
  hydrate?: boolean;
}

export interface SearchHit {
  entityType: IndexableEntityType;
  entityId: string;
  title: string;
  snippet: string;
  content: string;
  score: number;
  matchPercentage: number;
  reasons: string[];
  metadata: Record<string, unknown>;
  entity?: unknown;
}

export interface SearchResponse {
  query: string;
  hits: SearchHit[];
  tookMs: number;
  model: string;
}

/**
 * Hybrid retrieval engine used by search, the RAG assistant, recommendations
 * and matching. Everything semantic in this platform funnels through here, so
 * ranking behaviour is defined exactly once (DRY).
 *
 * score = 0.75 * cosine(vector) + 0.25 * lexical overlap
 * The lexical term keeps exact keyword matches ("Docker", "GSoC") competitive
 * even when the embedding model is generic.
 */
export class SemanticSearchService {
  private static readonly VECTOR_WEIGHT = 0.75;
  private static readonly LEXICAL_WEIGHT = 0.25;

  constructor(
    private readonly embeddings: IEmbeddingRepository,
    private readonly ai: IEmbeddingProvider,
    private readonly registry: EntityIndexRegistry,
    private readonly interactions?: IInteractionRepository,
  ) {}

  async search(query: string, options: SemanticSearchOptions = {}): Promise<SearchResponse> {
    const started = Date.now();
    const trimmed = query.trim();
    const types = options.types?.length ? options.types : this.registry.types();
    const limit = Math.min(50, Math.max(1, options.limit ?? 10));

    if (!trimmed) return { query, hits: [], tookMs: 0, model: 'none' };

    const { vectors, model } = await this.ai.embed([trimmed]);
    const queryVector = vectors[0] ?? [];
    const records = await this.embeddings.findByTypes(types);

    const hits = this.rank(trimmed, queryVector, records, limit, options.minScore ?? 0.05);

    if (options.hydrate !== false) await this.hydrate(hits);

    if (this.interactions && trimmed.length > 2) {
      await this.interactions.record({
        userId: options.userId ?? null,
        entityType: 'SEARCH',
        entityId: 'query',
        action: 'SEARCH',
        context: TextUtils.truncate(trimmed, 180),
      });
    }

    return { query: trimmed, hits, tookMs: Date.now() - started, model };
  }

  /** Vector-only ranking, reused by recommendations and collaborator matching. */
  async searchByVector(
    queryVector: number[],
    options: SemanticSearchOptions & { excludeIds?: string[]; lexicalText?: string } = {},
  ): Promise<SearchHit[]> {
    const types = options.types?.length ? options.types : this.registry.types();
    const limit = Math.min(50, Math.max(1, options.limit ?? 10));
    const records = (await this.embeddings.findByTypes(types)).filter(
      (record) => !options.excludeIds?.includes(record.entityId),
    );

    const hits = this.rank(options.lexicalText ?? '', queryVector, records, limit, options.minScore ?? 0);
    if (options.hydrate !== false) await this.hydrate(hits);
    return hits;
  }

  /** Raw chunks - the retrieval half of the RAG assistant. */
  async retrieveChunks(query: string, limit = 6, types?: IndexableEntityType[]): Promise<SearchHit[]> {
    const { vectors } = await this.ai.embed([query]);
    const records = await this.embeddings.findByTypes(types?.length ? types : this.registry.types());
    return this.rankChunks(query, vectors[0] ?? [], records).slice(0, limit);
  }

  private rank(
    queryText: string,
    queryVector: number[],
    records: EmbeddingRecord[],
    limit: number,
    minScore: number,
  ): SearchHit[] {
    const chunkHits = this.rankChunks(queryText, queryVector, records);

    // Keep the best chunk per entity so one long document cannot flood results.
    const best = new Map<string, SearchHit>();
    for (const hit of chunkHits) {
      const key = `${hit.entityType}:${hit.entityId}`;
      const existing = best.get(key);
      if (!existing || hit.score > existing.score) best.set(key, hit);
    }

    return [...best.values()]
      .filter((hit) => hit.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private rankChunks(queryText: string, queryVector: number[], records: EmbeddingRecord[]): SearchHit[] {
    const queryTokens = new Set(TextUtils.tokenize(queryText));

    return records
      .map((record) => {
        // Vectors produced by different models are not comparable; skip mismatches.
        const comparable = record.vector.length === queryVector.length && record.vector.length > 0;
        const vectorScore = comparable ? VectorMath.cosineSimilarity(queryVector, record.vector) : 0;

        const contentTokens = TextUtils.tokenize(record.content);
        const overlap = contentTokens.filter((token) => queryTokens.has(token)).length;
        const lexicalScore = queryTokens.size === 0 ? 0 : Math.min(1, overlap / queryTokens.size);

        const score =
          SemanticSearchService.VECTOR_WEIGHT * vectorScore + SemanticSearchService.LEXICAL_WEIGHT * lexicalScore;

        const reasons: string[] = [];
        if (vectorScore > 0.35) reasons.push('Strong semantic match');
        else if (vectorScore > 0.18) reasons.push('Related in meaning');
        if (overlap > 0) {
          const matched = [...queryTokens].filter((token) => contentTokens.includes(token)).slice(0, 4);
          reasons.push(`Mentions ${matched.join(', ')}`);
        }

        return {
          entityType: record.entityType,
          entityId: record.entityId,
          title: String(record.metadata.title ?? ''),
          snippet: TextUtils.truncate(record.content, 220),
          content: record.content,
          score,
          matchPercentage: toMatchPercentage(score),
          reasons,
          metadata: record.metadata,
        } satisfies SearchHit;
      })
      .sort((a, b) => b.score - a.score);
  }

  /** Attaches the full domain object to each hit for rich result cards. */
  private async hydrate(hits: SearchHit[]): Promise<void> {
    const grouped = new Map<IndexableEntityType, SearchHit[]>();
    for (const hit of hits) {
      const list = grouped.get(hit.entityType) ?? [];
      list.push(hit);
      grouped.set(hit.entityType, list);
    }

    await Promise.all(
      [...grouped.entries()].map(async ([type, typeHits]) => {
        const descriptor = this.registry.get(type);
        if (!descriptor) return;
        await Promise.all(
          typeHits.map(async (hit) => {
            hit.entity = (await descriptor.loadOne(hit.entityId)) ?? undefined;
          }),
        );
      }),
    );
  }
}
