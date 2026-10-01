import { createHash } from 'node:crypto';
import { TextUtils } from '../../core/text-utils';
import { VectorMath } from '../../core/vector-math';
import type {
  ChatMessage,
  ChatResult,
  EmbeddingResult,
  IAiProvider,
  SummarizationOptions,
  SummaryResult,
} from '../../domain/services/ai-provider';

const DIMENSION = 384;

/**
 * Offline AI provider.
 *
 * It implements the same interfaces as the Hugging Face provider so the rest
 * of the application cannot tell them apart (Liskov Substitution). This is what
 * makes the project runnable with zero API keys and zero network access.
 *
 *  - embed():     hashed bag-of-words projection (a "hashing vectorizer") with
 *                 sub-word shingles, TF weighting and L2 normalisation. Texts
 *                 about the same topic land close together in vector space.
 *  - summarize(): extractive TextRank-style scoring (term frequency + position
 *                 + title overlap) picking the most representative sentences.
 *  - complete():  grounded, template-based answer composition over the context
 *                 that the RAG pipeline already retrieved.
 */
export class LocalAiProvider implements IAiProvider {
  public readonly name = 'local';
  public readonly dimension = DIMENSION;

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const vectors = texts.map((text) => this.embedOne(text));
    return { vectors, model: 'local-hashing-vectorizer-v1', dimension: DIMENSION, provider: this.name };
  }

  private embedOne(text: string): number[] {
    const vector = new Array<number>(DIMENSION).fill(0);
    const tokens = TextUtils.tokenize(text);
    if (tokens.length === 0) return vector;

    const termFrequency = new Map<string, number>();
    for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);

    // Bigrams capture short phrases such as "machine learning".
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const bigram = `${tokens[i]}_${tokens[i + 1]}`;
      termFrequency.set(bigram, (termFrequency.get(bigram) ?? 0) + 0.5);
    }

    for (const [term, frequency] of termFrequency) {
      const weight = 1 + Math.log(frequency);
      for (const feature of this.features(term)) {
        const index = this.bucket(feature);
        const sign = this.sign(feature);
        vector[index] += sign * weight * (feature === term ? 1 : 0.35);
      }
    }

    return VectorMath.normalize(vector);
  }

  /** A term plus its character shingles: gives fuzzy matching over typos/morphology. */
  private features(term: string): string[] {
    const out = [term];
    if (term.length > 4 && !term.includes('_')) {
      for (let i = 0; i <= term.length - 3; i += 1) out.push(term.slice(i, i + 3));
    }
    return out;
  }

  private bucket(feature: string): number {
    const hash = createHash('md5').update(feature).digest();
    return hash.readUInt32BE(0) % DIMENSION;
  }

  private sign(feature: string): number {
    const hash = createHash('md5').update(`sign:${feature}`).digest();
    return hash[0] % 2 === 0 ? 1 : -1;
  }

  async summarize(text: string, options?: SummarizationOptions): Promise<SummaryResult> {
    const maxSentences = options?.maxSentences ?? 3;
    const clean = text.replace(/\s+/g, ' ').trim();
    const sentences = TextUtils.sentences(clean);

    if (sentences.length <= maxSentences) {
      return {
        summary: clean,
        highlights: TextUtils.keywords(clean, 6),
        provider: this.name,
      };
    }

    const frequency = new Map<string, number>();
    for (const token of TextUtils.tokenize(clean)) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
    const maxFrequency = Math.max(...frequency.values(), 1);

    const scored = sentences.map((sentence, index) => {
      const tokens = TextUtils.tokenize(sentence);
      if (tokens.length === 0) return { sentence, index, score: 0 };
      const relevance =
        tokens.reduce((sum, token) => sum + (frequency.get(token) ?? 0) / maxFrequency, 0) / Math.sqrt(tokens.length);
      // Leading sentences usually carry the "what/when/where" of an announcement.
      const positionBoost = 1 + Math.max(0, 0.35 - index * 0.07);
      const lengthPenalty = tokens.length < 4 ? 0.5 : 1;
      return { sentence, index, score: relevance * positionBoost * lengthPenalty };
    });

    const picked = [...scored]
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .sort((a, b) => a.index - b.index);

    const summary =
      options?.style === 'bullets'
        ? picked.map((entry) => `• ${entry.sentence}`).join('\n')
        : picked.map((entry) => entry.sentence).join(' ');

    return { summary, highlights: TextUtils.keywords(clean, 6), provider: this.name };
  }

  /**
   * Composes an answer strictly from the context supplied by the RAG pipeline.
   * Without an LLM we cannot generate free prose, so we select and stitch the
   * passages that best answer the question - which also keeps it grounded.
   */
  async complete(messages: ChatMessage[]): Promise<ChatResult> {
    const question = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
    const context = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');

    const contextBody = context.split('CONTEXT:').slice(1).join('\n').trim();
    const passages = this.parsePassages(contextBody);

    if (passages.length === 0) {
      return {
        content:
          'I could not find anything about that in the community knowledge base yet. Try asking about events, resources, announcements or communities that have been published.',
        provider: this.name,
      };
    }

    const questionTokens = new Set(TextUtils.tokenize(question));
    const ranked = passages
      .map((passage) => {
        const tokens = TextUtils.tokenize(passage.body);
        const overlap = new Set(tokens.filter((token) => questionTokens.has(token))).size;
        return { ...passage, score: overlap / Math.sqrt(questionTokens.size || 1) };
      })
      .sort((a, b) => b.score - a.score);

    // Keep one passage per source so overlapping chunks do not repeat themselves,
    // and drop passages that share no vocabulary with the question.
    const hasRelevant = ranked.some((passage) => passage.score > 0);
    const chosen: typeof ranked = [];
    for (const passage of ranked) {
      if (hasRelevant && passage.score <= 0) break;
      if (chosen.some((existing) => existing.title === passage.title)) continue;
      chosen.push(passage);
      if (chosen.length === 3) break;
    }

    const body = chosen
      .map((passage) => `**${passage.title}** (${passage.type.toLowerCase()})\n${TextUtils.truncate(passage.body, 420)}`)
      .join('\n\n');

    return {
      content: `Here is what the community knowledge base says:\n\n${body}`,
      provider: this.name,
    };
  }

  /**
   * Parses the `[n] TYPE :: Title` + body blocks produced by the RAG pipeline
   * and cleans each body: chunk overlap leaves dangling word fragments at the
   * start and the indexer repeats the title, both of which read badly.
   */
  private parsePassages(contextBody: string): { type: string; title: string; body: string }[] {
    const passages: { type: string; title: string; body: string }[] = [];

    for (const block of contextBody.split(/\n{2,}/)) {
      const [header, ...rest] = block.split('\n');
      const match = /^\[\d+\]\s+([A-Z]+)\s*::\s*(.*)$/.exec(header.trim());
      if (!match) continue;

      const [, type, title] = match;
      let body = rest.join(' ').trim();

      // The indexer prefixes every chunk with the title - drop the echo.
      if (body.toLowerCase().startsWith(`${title.toLowerCase()}.`)) body = body.slice(title.length + 1).trim();

      // Overlapping chunks can begin mid-word or mid-sentence.
      const sentences = TextUtils.sentences(body);
      while (sentences.length > 1 && /^[a-z]/.test(sentences[0])) sentences.shift();
      body = sentences.join(' ').trim();

      if (body.length > 30) passages.push({ type, title, body });
    }

    return passages;
  }
}
