import { NotFoundError } from '../../core/errors';
import { TextUtils } from '../../core/text-utils';
import { VectorMath } from '../../core/vector-math';import type { IndexableEntityType, Report } from '../../domain/entities/models';
import type { IEmbeddingRepository, IReportRepository } from '../../domain/repositories';
import type { IEmbeddingProvider } from '../../domain/services/ai-provider';

export interface TriageResult {
  verdict: 'LIKELY_DUPLICATE' | 'LIKELY_SPAM' | 'POSSIBLY_INAPPROPRIATE' | 'NEEDS_HUMAN_REVIEW' | 'LIKELY_FINE';
  score: number;
  rationale: string;
  duplicates: { entityType: IndexableEntityType; entityId: string; title: string; similarity: number }[];
}

/**
 * Moderation: reporting + automated triage.
 *
 * Triage combines three cheap, explainable checks instead of a black box:
 *  1. vector near-duplicate detection against everything already indexed
 *  2. spam heuristics (links, shouting, promo phrases)
 *  3. an inappropriate-language lexicon
 * The result is a priority score - a human always makes the final call.
 */
export class ModerationService {
  private static readonly SPAM_PATTERNS = [
    /\b(buy now|limited offer|click here|earn \$?\d+|work from home|crypto giveaway|free money)\b/i,
    /(https?:\/\/[^\s]+){3,}/i,
    /\b(whatsapp|telegram)\s*(\+?\d[\d\s-]{7,})/i,
  ];

  private static readonly INAPPROPRIATE_TERMS = [
    'scam', 'fraud', 'hate', 'abuse', 'harass', 'nsfw', 'slur', 'threat',
  ];

  /**
   * Thresholds calibrated against the seed corpus with the offline embedder:
   *   exact re-post     ~0.58
   *   reworded re-post  ~0.46
   *   unrelated content ~0.12
   * so 0.55 marks a duplicate and 0.40 is worth showing to a moderator.
   */
  private static readonly DUPLICATE_THRESHOLD = 0.55;
  private static readonly SIMILAR_THRESHOLD = 0.4;
  private static readonly W_VECTOR = 0.5;
  private static readonly W_LEXICAL = 0.5;

  constructor(
    private readonly reports: IReportRepository,
    private readonly embeddings: IEmbeddingRepository,
    private readonly ai: IEmbeddingProvider,
  ) {}

  /** Runs before content is reported or right after it is published. */
  async triage(input: {
    entityType: IndexableEntityType;
    entityId?: string;
    title: string;
    body: string;
  }): Promise<TriageResult> {
    const text = `${input.title}. ${input.body}`.trim();
    const duplicates = await this.findDuplicates(text, input.entityType, input.entityId);

    const spamHits = ModerationService.SPAM_PATTERNS.filter((pattern) => pattern.test(text));
    const tokens = new Set(TextUtils.tokenize(text));
    const inappropriate = ModerationService.INAPPROPRIATE_TERMS.filter((term) => tokens.has(term));

    const shouting = text.replace(/[^A-Za-z]/g, '').length > 40 && text === text.toUpperCase();
    const linkDensity = (text.match(/https?:\/\//g) ?? []).length;

    let score = 0;
    const rationale: string[] = [];

    if (duplicates.length > 0) {
      score = Math.max(score, duplicates[0].similarity);
      rationale.push(
        `Very similar to existing content "${duplicates[0].title}" (${Math.round(duplicates[0].similarity * 100)}% overlap)`,
      );
    }
    if (spamHits.length > 0) {
      score = Math.max(score, 0.75 + 0.05 * spamHits.length);
      rationale.push(`Matches ${spamHits.length} promotional spam pattern(s)`);
    }
    if (inappropriate.length > 0) {
      score = Math.max(score, 0.7);
      rationale.push(`Contains flagged terms: ${inappropriate.join(', ')}`);
    }
    if (shouting) {
      score = Math.max(score, 0.45);
      rationale.push('Written entirely in capital letters');
    }
    if (linkDensity >= 3) {
      score = Math.max(score, 0.5);
      rationale.push(`${linkDensity} outbound links`);
    }

    const verdict: TriageResult['verdict'] =
      duplicates.length > 0 && duplicates[0].similarity >= ModerationService.DUPLICATE_THRESHOLD
        ? 'LIKELY_DUPLICATE'
        : spamHits.length > 0
          ? 'LIKELY_SPAM'
          : inappropriate.length > 0
            ? 'POSSIBLY_INAPPROPRIATE'
            : score >= 0.45
              ? 'NEEDS_HUMAN_REVIEW'
              : 'LIKELY_FINE';

    return {
      verdict,
      score: Math.round(Math.min(1, score) * 100) / 100,
      rationale: rationale.join('; ') || 'No automated signal detected - content looks fine.',
      duplicates,
    };
  }

  async report(input: {
    targetType: IndexableEntityType;
    targetId: string;
    targetTitle: string;
    reporterId: string;
    reason: string;
    details?: string;
  }): Promise<Report> {
    const triage = await this.triage({
      entityType: input.targetType,
      entityId: input.targetId,
      title: input.targetTitle,
      body: input.details ?? '',
    });

    return this.reports.create({
      targetType: input.targetType,
      targetId: input.targetId,
      targetTitle: input.targetTitle,
      reporterId: input.reporterId,
      reason: input.reason,
      details: input.details ?? '',
      aiVerdict: triage.verdict,
      aiScore: triage.score,
      aiRationale: triage.rationale,
    });
  }

  list(query: { status?: string; page?: number; pageSize?: number }) {
    return this.reports.findMany(query);
  }

  async resolve(id: string, data: { status: string; reviewerId: string; resolution?: string }): Promise<Report> {
    const existing = await this.reports.findById(id);
    if (!existing) throw new NotFoundError('Report');
    return this.reports.updateStatus(id, data);
  }

  stats(): Promise<Record<string, number>> {
    return this.reports.countByStatus();
  }

  private async findDuplicates(
    text: string,
    entityType: IndexableEntityType,
    excludeId?: string,
  ): Promise<TriageResult['duplicates']> {
    const { vectors } = await this.ai.embed([text]);
    const queryVector = vectors[0] ?? [];
    const records = await this.embeddings.findByTypes([entityType]);

    const best = new Map<string, { title: string; similarity: number }>();
    for (const record of records) {
      if (record.entityId === excludeId) continue;

      // Indexed chunks are enriched with metadata and may be partial, so pure
      // cosine under-reports a copy. Blending it with lexical containment
      // makes an exact re-post score high while unrelated content stays low.
      const cosine =
        record.vector.length === queryVector.length && record.vector.length > 0
          ? VectorMath.cosineSimilarity(queryVector, record.vector)
          : 0;
      const containment = TextUtils.containment(text, record.content);
      const similarity =
        ModerationService.W_VECTOR * Math.max(0, cosine) + ModerationService.W_LEXICAL * containment;

      const current = best.get(record.entityId);
      if (!current || similarity > current.similarity) {
        best.set(record.entityId, { title: String(record.metadata.title ?? ''), similarity });
      }
    }

    return [...best.entries()]
      .filter(([, value]) => value.similarity >= ModerationService.SIMILAR_THRESHOLD)
      .sort((a, b) => b[1].similarity - a[1].similarity)
      .slice(0, 3)
      .map(([entityId, value]) => ({
        entityType,
        entityId,
        title: value.title,
        similarity: Math.round(value.similarity * 100) / 100,
      }));
  }
}
