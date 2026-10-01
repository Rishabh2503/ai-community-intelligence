import { TextUtils } from '../../core/text-utils';
import type { IndexableEntityType } from '../../domain/entities/models';
import type { IAssistantQueryRepository } from '../../domain/repositories';
import type { ChatMessage, IChatProvider } from '../../domain/services/ai-provider';
import type { SemanticSearchService } from './semantic-search.service';

export interface AssistantSource {
  entityType: IndexableEntityType;
  entityId: string;
  title: string;
  snippet: string;
  matchPercentage: number;
}

export interface AssistantAnswer {
  question: string;
  answer: string;
  sources: AssistantSource[];
  followUps: string[];
  provider: string;
  latencyMs: number;
  grounded: boolean;
  /**
   * community  - answered from published community content, with citations
   * general    - outside the knowledge base, answered from the model's own
   *              general knowledge and clearly labelled as such
   * unavailable- neither was possible, so the assistant declines
   */
  answerMode: 'community' | 'general' | 'unavailable';
}

/**
 * Retrieval Augmented Generation over community knowledge.
 *
 * Pipeline: retrieve -> build grounded prompt -> generate -> cite -> log.
 * Retrieval is delegated to `SemanticSearchService` and generation to an
 * `IChatProvider`, so this class only owns prompt construction and citation
 * (Single Responsibility).
 */
export class AssistantService {
  private static readonly SYSTEM_PROMPT = [
    'You are Community Space Assistant, the knowledge assistant of a community platform.',
    'Answer ONLY from the CONTEXT provided below.',
    'If the context does not contain the answer, say you do not have that information yet and suggest what to publish.',
    'Be concise (max 6 sentences), friendly, and mention concrete titles, dates and venues when they appear.',
  ].join(' ');

  /**
   * Used when the question falls outside the community knowledge base. The
   * assistant still helps, but the answer is labelled as general knowledge so
   * a member never mistakes it for something their community published.
   */
  private static readonly GENERAL_PROMPT = [
    'You are Community Space Assistant. The user asked something that is not covered by this community\'s published content.',
    'Answer helpfully from your own general knowledge.',
    'Be concise (max 5 sentences) and factual.',
    'If the question needs live data you cannot access (current weather, prices, news, scores), say so plainly and explain what the user would need to check instead.',
    'Never invent details about this specific community, its events, its members or its schedule.',
  ].join(' ');

  /**
   * Minimum share of the question's vocabulary that must appear in the
   * retrieved context before the assistant is allowed to answer.
   *
   * Measured on the seed corpus:
   *   answerable   "winter hackathon team size rules"      0.80
   *                "resources explaining RAG chunking"     1.00
   *                "how to join the CKA study group"       0.75
   *   unanswerable "dress code and parking at the venue"   0.60
   *                "refund policy for paid workshops"      0.50
   *                "free lunch and airport pickup"         0.17
   *
   * 0.7 separates the two groups. Refusing a borderline question is the safer
   * failure mode for a knowledge assistant than inventing an answer.
   */
  private static readonly MIN_COVERAGE = 0.7;

  constructor(
    private readonly search: SemanticSearchService,
    private readonly chat: IChatProvider,
    private readonly queries: IAssistantQueryRepository,
    /** Keyless open-model provider used only for out-of-scope questions. */
    private readonly generalChat?: IChatProvider,
  ) {}

  async ask(question: string, options: { userId?: string | null; topK?: number } = {}): Promise<AssistantAnswer> {
    const started = Date.now();
    const trimmed = question.trim();
    const chunks = await this.search.retrieveChunks(trimmed, options.topK ?? 6);
    const relevant = chunks.filter((chunk) => chunk.score > 0.08);
    const used = relevant.length > 0 ? relevant : chunks.slice(0, 3);

    const context = used
      .map((chunk, index) => `[${index + 1}] ${chunk.entityType} :: ${chunk.title}\n${chunk.content}`)
      .join('\n\n');

    // A high similarity score does not mean the question was actually answered:
    // "refund policy for paid workshops" matches workshop content strongly while
    // saying nothing about refunds. Coverage measures how much of the question's
    // own vocabulary the retrieved context can account for, which is what
    // decides whether we are entitled to answer at all.
    const coverage = this.coverage(trimmed, context);
    const grounded = used.length > 0 && coverage >= AssistantService.MIN_COVERAGE;

    let content: string;
    let provider: string;
    let answerMode: AssistantAnswer['answerMode'];

    if (grounded) {
      const result = await this.chat.complete([
        { role: 'system', content: AssistantService.SYSTEM_PROMPT },
        { role: 'system', content: `CONTEXT:\n${context}` },
        { role: 'user', content: trimmed },
      ]);
      content = result.content;
      provider = result.provider;
      answerMode = 'community';
    } else {
      // Outside the knowledge base. Rather than a dead end, fall back to
      // general knowledge - but only when a real language model is available,
      // because the offline provider can only recombine retrieved passages.
      const general = await this.generalAnswer(trimmed);
      if (general) {
        content = general.content;
        provider = general.provider;
        answerMode = 'general';
      } else {
        content = this.notFoundAnswer(used);
        provider = 'guardrail';
        answerMode = 'unavailable';
      }
    }

    const sources: AssistantSource[] = grounded ? this.dedupeSources(used) : [];
    const answer: AssistantAnswer = {
      question: trimmed,
      answer: content,
      sources,
      followUps: this.followUps(grounded ? sources : this.dedupeSources(used)),
      provider,
      latencyMs: Date.now() - started,
      grounded,
      answerMode,
    };

    await this.queries.record({
      userId: options.userId ?? null,
      question: trimmed,
      answer: content,
      sources: sources.map((source) => ({ type: source.entityType, id: source.entityId, title: source.title })),
      topicLabel: this.topicLabel(trimmed),
      latencyMs: answer.latencyMs,
      provider,
    });

    return answer;
  }

  /**
   * General-knowledge answer for questions the community has no content for.
   *
   * Tries the configured chat model first, then a keyless open provider. The
   * offline provider is skipped deliberately: it composes answers out of
   * retrieved passages and cannot answer open questions, so a clean refusal is
   * more honest than nonsense.
   */
  private async generalAnswer(question: string): Promise<{ content: string; provider: string } | null> {
    const prompt: ChatMessage[] = [
      { role: 'system', content: AssistantService.GENERAL_PROMPT },
      { role: 'user', content: question },
    ];

    const candidates: IChatProvider[] = [this.chat, ...(this.generalChat ? [this.generalChat] : [])];

    for (const provider of candidates) {
      try {
        const result = await provider.complete(prompt);
        const usable = !result.provider.toLowerCase().includes('local') && result.content.trim().length > 20;
        if (usable) return { content: result.content.trim(), provider: result.provider };
      } catch {
        // Try the next provider.
      }
    }

    return null;
  }

  /** Fraction of the question's meaningful words that appear in the retrieved context. */
  private coverage(question: string, context: string): number {
    const questionTokens = new Set(TextUtils.contentTokens(question));
    if (questionTokens.size === 0) return 1;
    const contextTokens = new Set(TextUtils.tokenize(context));
    let covered = 0;
    for (const token of questionTokens) if (contextTokens.has(token)) covered += 1;
    return covered / questionTokens.size;
  }

  /**
   * Refusing well is a feature: name the closest topics we do know about so the
   * member can redirect, and so organizers can see the gap in analytics.
   */
  private notFoundAnswer(chunks: { title: string }[]): string {
    const nearby = [...new Set(chunks.map((chunk) => chunk.title))].slice(0, 3);
    const suggestion =
      nearby.length > 0
        ? ` The closest published content I could find is: ${nearby.map((title) => `"${title}"`).join(', ')}.`
        : '';
    return `I don't have that information in the community knowledge base yet, so I'd rather not guess.${suggestion} An organizer can publish it as an announcement or resource and I'll be able to answer next time.`;
  }

  private dedupeSources(chunks: { entityType: IndexableEntityType; entityId: string; title: string; snippet: string; matchPercentage: number }[]): AssistantSource[] {
    const seen = new Set<string>();
    const sources: AssistantSource[] = [];
    for (const chunk of chunks) {
      const key = `${chunk.entityType}:${chunk.entityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({
        entityType: chunk.entityType,
        entityId: chunk.entityId,
        title: chunk.title,
        snippet: chunk.snippet,
        matchPercentage: chunk.matchPercentage,
      });
    }
    return sources.slice(0, 5);
  }

  /** Conversation-based discovery: propose the next useful question. */
  private followUps(sources: AssistantSource[]): string[] {
    const suggestions = new Set<string>();
    for (const source of sources.slice(0, 3)) {
      if (source.entityType === 'EVENT') suggestions.add(`What should I prepare for "${source.title}"?`);
      if (source.entityType === 'RESOURCE') suggestions.add(`Are there more resources like "${source.title}"?`);
      if (source.entityType === 'COMMUNITY') suggestions.add(`How do I get involved in ${source.title}?`);
      if (source.entityType === 'PROJECT') suggestions.add(`Who can I team up with for "${source.title}"?`);
    }
    suggestions.add('Which events are happening this month?');
    suggestions.add('Who has experience with machine learning?');
    return [...suggestions].slice(0, 4);
  }

  /** Cheap topic label so organizers can see frequently requested information. */
  private topicLabel(question: string): string {
    const keywords = TextUtils.keywords(question, 3);
    return keywords.join(' ') || 'general';
  }
}
