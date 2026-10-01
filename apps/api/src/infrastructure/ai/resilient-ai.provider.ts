import { createLogger } from '../../core/logger';
import type {
  ChatMessage,
  ChatResult,
  EmbeddingResult,
  IAiProvider,
  SummarizationOptions,
  SummaryResult,
} from '../../domain/services/ai-provider';

const logger = createLogger('ResilientAiProvider');

/**
 * Decorator that adds resilience to any `IAiProvider`.
 *
 * It keeps the exact same interface as the object it wraps, so callers are
 * unaware of it (Open/Closed + Liskov). If the primary provider throws, times
 * out or is rate-limited, the fallback answers instead - which is how the demo
 * keeps working without an internet connection or an API key.
 */
export class ResilientAiProvider implements IAiProvider {
  public readonly name: string;

  constructor(
    private readonly primary: IAiProvider,
    private readonly fallback: IAiProvider,
  ) {
    this.name = `${primary.name}+${fallback.name}`;
  }

  get dimension(): number {
    return this.primary.dimension;
  }

  private async attempt<T>(operation: string, run: (provider: IAiProvider) => Promise<T>): Promise<T> {
    try {
      return await run(this.primary);
    } catch (error) {
      logger.warn(`${operation} failed on "${this.primary.name}", falling back to "${this.fallback.name}"`, {
        reason: error instanceof Error ? error.message : String(error),
      });
      return run(this.fallback);
    }
  }

  embed(texts: string[]): Promise<EmbeddingResult> {
    return this.attempt('embed', (provider) => provider.embed(texts));
  }

  summarize(text: string, options?: SummarizationOptions): Promise<SummaryResult> {
    return this.attempt('summarize', (provider) => provider.summarize(text, options));
  }

  complete(messages: ChatMessage[], options?: { maxTokens?: number; temperature?: number }): Promise<ChatResult> {
    return this.attempt('complete', (provider) => provider.complete(messages, options));
  }
}

/**
 * Decorator that memoises embeddings for repeated texts (search queries are
 * repeated a lot during a demo). Again: same interface, no caller changes.
 */
export class CachedEmbeddingProvider implements IAiProvider {
  private readonly cache = new Map<string, number[]>();
  public readonly name: string;

  constructor(
    private readonly inner: IAiProvider,
    private readonly maxEntries = 500,
  ) {
    this.name = `cached(${inner.name})`;
  }

  get dimension(): number {
    return this.inner.dimension;
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const missing = texts.filter((text) => !this.cache.has(text));
    let model = 'cache';
    let provider = this.inner.name;

    if (missing.length > 0) {
      const result = await this.inner.embed(missing);
      model = result.model;
      provider = result.provider;
      missing.forEach((text, index) => {
        if (this.cache.size >= this.maxEntries) {
          const oldest = this.cache.keys().next().value;
          if (oldest !== undefined) this.cache.delete(oldest);
        }
        this.cache.set(text, result.vectors[index] ?? []);
      });
      this.lastModel = model;
    }

    const vectors = texts.map((text) => this.cache.get(text) ?? []);
    return {
      vectors,
      model: missing.length > 0 ? model : this.lastModel,
      dimension: vectors[0]?.length ?? this.inner.dimension,
      provider,
    };
  }

  private lastModel = 'local-hashing-vectorizer-v1';

  summarize(text: string, options?: SummarizationOptions): Promise<SummaryResult> {
    return this.inner.summarize(text, options);
  }

  complete(messages: ChatMessage[], options?: { maxTokens?: number; temperature?: number }): Promise<ChatResult> {
    return this.inner.complete(messages, options);
  }
}
