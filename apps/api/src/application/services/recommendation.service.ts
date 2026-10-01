import { VectorMath, toMatchPercentage } from '../../core/vector-math';
import { TextUtils } from '../../core/text-utils';
import type { IndexableEntityType, Profile } from '../../domain/entities/models';
import type { IEmbeddingRepository, IInteractionRepository, IProfileRepository } from '../../domain/repositories';
import type { IEmbeddingProvider } from '../../domain/services/ai-provider';
import type { SearchHit, SemanticSearchService } from './semantic-search.service';

export interface RecommendationRequest {
  userId?: string | null;
  intent?: string;
  types?: IndexableEntityType[];
  limit?: number;
}

export interface RecommendationResponse {
  basis: string;
  intent: string;
  items: SearchHit[];
}

/**
 * Turns "who the user is + what they just said they want" into a single
 * interest vector, then reuses the shared retrieval engine.
 *
 * Note how no embedding maths is duplicated here: the service composes
 * `SemanticSearchService` instead of re-implementing ranking (DRY).
 */
export class RecommendationService {
  constructor(
    private readonly search: SemanticSearchService,
    private readonly profiles: IProfileRepository,
    private readonly interactions: IInteractionRepository,
    private readonly embeddings: IEmbeddingRepository,
    private readonly ai: IEmbeddingProvider,
  ) {}

  async recommend(request: RecommendationRequest): Promise<RecommendationResponse> {
    const limit = request.limit ?? 8;
    const types = request.types ?? ['EVENT', 'RESOURCE', 'COMMUNITY', 'PROJECT'];
    const intent = request.intent?.trim() ?? '';

    const profile = request.userId ? await this.profiles.findByUserId(request.userId) : null;
    const vectors: number[][] = [];
    const basisParts: string[] = [];

    if (intent) {
      const { vectors: intentVectors } = await this.ai.embed([intent]);
      // The explicit intent dominates: it is added twice before averaging.
      vectors.push(intentVectors[0], intentVectors[0]);
      basisParts.push(`your request "${TextUtils.truncate(intent, 60)}"`);
    }

    if (profile) {
      const profileText = this.profileText(profile);
      const { vectors: profileVectors } = await this.ai.embed([profileText]);
      vectors.push(profileVectors[0]);
      basisParts.push(`your skills (${profile.skills.slice(0, 3).join(', ') || 'not set yet'})`);
      if (profile.location) basisParts.push(`your region (${profile.location})`);
    }

    const historyVectors = request.userId ? await this.historyVectors(request.userId) : [];
    if (historyVectors.length > 0) {
      vectors.push(VectorMath.centroid(historyVectors));
      basisParts.push('what you recently viewed and joined');
    }

    if (vectors.length === 0) {
      // Cold start: show what the community is engaging with most.
      const trending = await this.trending(types, limit);
      return { basis: 'community activity (no profile signals yet)', intent, items: trending };
    }

    const interestVector = VectorMath.centroid(vectors);
    const seenIds = request.userId ? await this.seenEntityIds(request.userId) : [];
    const hits = await this.search.searchByVector(interestVector, {
      types,
      limit,
      excludeIds: seenIds,
      lexicalText: intent || profile?.skills.join(' ') || '',
    });

    return { basis: basisParts.join(' + '), intent, items: hits };
  }

  private profileText(profile: Profile): string {
    return [
      profile.headline,
      profile.bio,
      `Skills: ${profile.skills.join(', ')}`,
      `Interests: ${profile.interests.join(', ')}`,
      `Expertise: ${profile.expertise.join(', ')}`,
      profile.location ? `Location: ${profile.location}` : '',
    ]
      .filter(Boolean)
      .join('. ');
  }

  private async historyVectors(userId: string): Promise<number[][]> {
    const history = await this.interactions.listByUser(userId, 25);
    const vectors: number[][] = [];
    for (const item of history.slice(0, 12)) {
      if (item.entityType === 'SEARCH') continue;
      const records = await this.embeddings.findForEntity(item.entityType as IndexableEntityType, item.entityId);
      if (records[0]) vectors.push(records[0].vector);
    }
    return vectors;
  }

  private async seenEntityIds(userId: string): Promise<string[]> {
    const history = await this.interactions.listByUser(userId, 40);
    return history.filter((item) => ['RSVP', 'JOIN', 'SAVE'].includes(item.action)).map((item) => item.entityId);
  }

  private async trending(types: IndexableEntityType[], limit: number): Promise<SearchHit[]> {
    const records = await this.embeddings.findByTypes(types);
    const counts: Record<string, number> = {};
    for (const type of types) {
      Object.assign(counts, await this.interactions.countsByEntity(type));
    }

    const seen = new Set<string>();
    const items: SearchHit[] = [];
    for (const record of records) {
      const key = `${record.entityType}:${record.entityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const popularity = counts[record.entityId] ?? 0;
      items.push({
        entityType: record.entityType,
        entityId: record.entityId,
        title: String(record.metadata.title ?? ''),
        snippet: TextUtils.truncate(record.content, 200),
        content: record.content,
        score: popularity,
        matchPercentage: toMatchPercentage(Math.min(1, popularity / 10)),
        reasons: popularity > 0 ? [`${popularity} recent interactions`] : ['New in the community'],
        metadata: record.metadata,
      });
    }
    return items.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
