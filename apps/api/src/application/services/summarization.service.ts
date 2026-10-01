import { TextUtils } from '../../core/text-utils';
import type { ISummarizationProvider, SummaryResult } from '../../domain/services/ai-provider';

/**
 * Thin policy layer around the raw summarization provider:
 * decides *when* summarising is worth it and guarantees a usable result.
 * Content services call this instead of the provider so the policy is not
 * duplicated in five places (DRY).
 */
export class SummarizationService {
  private static readonly MIN_CHARS = 280;

  constructor(private readonly ai: ISummarizationProvider) {}

  async summarize(text: string, options?: { maxSentences?: number; style?: 'brief' | 'bullets' }): Promise<SummaryResult> {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length < SummarizationService.MIN_CHARS) {
      return { summary: clean, highlights: TextUtils.keywords(clean, 5), provider: 'passthrough' };
    }
    return this.ai.summarize(clean, { maxSentences: options?.maxSentences ?? 3, style: options?.style });
  }

  /** Used on create/update by every content service. */
  async summaryFor(title: string, body: string): Promise<string> {
    const result = await this.summarize(`${title}. ${body}`);
    return result.summary;
  }
}
