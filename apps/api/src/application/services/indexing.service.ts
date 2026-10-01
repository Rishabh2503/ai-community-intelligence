import { createLogger } from '../../core/logger';
import { TextUtils } from '../../core/text-utils';
import type { IndexableEntityType } from '../../domain/entities/models';
import type { EmbeddingUpsertInput, IEmbeddingRepository } from '../../domain/repositories';
import type { IEmbeddingProvider } from '../../domain/services/ai-provider';
import type { EntityIndexRegistry } from './entity-index.registry';

const logger = createLogger('IndexingService');

/**
 * Owns exactly one responsibility: keeping the vector index in sync with
 * content (Single Responsibility). Every content service calls the same two
 * methods, so chunking/embedding rules live in a single place (DRY).
 */
export class IndexingService {
  constructor(
    private readonly registry: EntityIndexRegistry,
    private readonly embeddings: IEmbeddingRepository,
    private readonly ai: IEmbeddingProvider,
  ) {}

  async indexEntity(type: IndexableEntityType, id: string): Promise<void> {
    const descriptor = this.registry.get(type);
    if (!descriptor) {
      logger.warn(`No index descriptor registered for type ${type}`);
      return;
    }

    const entity = await descriptor.loadOne(id);
    if (!entity) {
      await this.embeddings.deleteForEntity(type, id);
      return;
    }

    const document = descriptor.toDocument(entity);
    const chunks = this.buildChunks(document.title, document.text);
    if (chunks.length === 0) return;

    const { vectors, model } = await this.ai.embed(chunks);
    const records: EmbeddingUpsertInput[] = chunks.map((content, chunkIndex) => ({
      entityType: type,
      entityId: id,
      chunkIndex,
      content,
      vector: vectors[chunkIndex] ?? [],
      model,
      metadata: { ...document.metadata, title: document.title },
    }));

    await this.embeddings.deleteForEntity(type, id);
    await this.embeddings.upsertMany(records);
  }

  async removeEntity(type: IndexableEntityType, id: string): Promise<void> {
    await this.embeddings.deleteForEntity(type, id);
  }

  /**
   * Flattens every indexable entity into plain documents.
   * Reuses the same `EntityIndexDescriptor` strategies as the vector index, so
   * an external knowledge store (Cognee) is fed exactly the same corpus without
   * duplicating the "how do I turn an entity into text" logic (DRY).
   */
  async exportCorpus(): Promise<string[]> {
    const documents: string[] = [];
    for (const descriptor of this.registry.all()) {
      for (const entity of await descriptor.loadAll()) {
        const document = descriptor.toDocument(entity);
        documents.push(`${descriptor.type} :: ${document.title}\n${document.text}`);
      }
    }
    return documents;
  }

  /** Full rebuild - used by the seed script and the admin "reindex" endpoint. */
  async reindexAll(): Promise<{ indexed: number; byType: Record<string, number> }> {
    const byType: Record<string, number> = {};
    let indexed = 0;

    for (const descriptor of this.registry.all()) {
      const entities = await descriptor.loadAll();
      const documents = entities.map((entity) => ({
        id: descriptor.getId(entity),
        document: descriptor.toDocument(entity),
      }));

      const flattened: { entityId: string; chunkIndex: number; content: string; metadata: Record<string, unknown> }[] = [];
      for (const { id, document } of documents) {
        this.buildChunks(document.title, document.text).forEach((content, chunkIndex) => {
          flattened.push({ entityId: id, chunkIndex, content, metadata: { ...document.metadata, title: document.title } });
        });
      }

      if (flattened.length === 0) {
        byType[descriptor.type] = 0;
        continue;
      }

      // Batch so a single Hugging Face call covers many documents.
      const batchSize = 32;
      const records: EmbeddingUpsertInput[] = [];
      for (let i = 0; i < flattened.length; i += batchSize) {
        const batch = flattened.slice(i, i + batchSize);
        const { vectors, model } = await this.ai.embed(batch.map((entry) => entry.content));
        batch.forEach((entry, index) => {
          records.push({
            entityType: descriptor.type,
            entityId: entry.entityId,
            chunkIndex: entry.chunkIndex,
            content: entry.content,
            vector: vectors[index] ?? [],
            model,
            metadata: entry.metadata,
          });
        });
      }

      await this.embeddings.upsertMany(records);
      byType[descriptor.type] = documents.length;
      indexed += documents.length;
      logger.info(`Indexed ${documents.length} ${descriptor.type} entities (${records.length} chunks)`);
    }

    return { indexed, byType };
  }

  /**
   * The title is prepended to every chunk so that a chunk taken from the middle
   * of a long announcement still carries its subject.
   */
  private buildChunks(title: string, text: string): string[] {
    const body = `${title}. ${text}`.replace(/\s+/g, ' ').trim();
    if (!body) return [];
    return TextUtils.chunk(body, 700, 120).map((chunk) => (chunk.startsWith(title) ? chunk : `${title}. ${chunk}`));
  }
}
