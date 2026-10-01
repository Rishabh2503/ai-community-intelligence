/**
 * AI provider contracts.
 *
 * The platform needs three capabilities: turning text into vectors,
 * condensing long text, and answering grounded questions. Each capability is
 * its own interface so an implementation can provide one without being forced
 * to implement the others (Interface Segregation).
 *
 * Two implementations ship with the project:
 *   - `HuggingFaceAiProvider` (free Inference API)
 *   - `LocalAiProvider`       (deterministic, offline, zero dependencies)
 * They are interchangeable (Liskov Substitution) and selected at composition
 * time, which means new providers (OpenAI, Ollama, ...) can be added without
 * touching any service (Open/Closed).
 */

export interface EmbeddingResult {
  vectors: number[][];
  model: string;
  dimension: number;
  provider: string;
}

export interface IEmbeddingProvider {
  readonly name: string;
  readonly dimension: number;
  embed(texts: string[]): Promise<EmbeddingResult>;
}

export interface SummarizationOptions {
  maxSentences?: number;
  style?: 'brief' | 'bullets';
}

export interface SummaryResult {
  summary: string;
  highlights: string[];
  provider: string;
}

export interface ISummarizationProvider {
  readonly name: string;
  summarize(text: string, options?: SummarizationOptions): Promise<SummaryResult>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  provider: string;
}

export interface IChatProvider {
  readonly name: string;
  complete(messages: ChatMessage[], options?: { maxTokens?: number; temperature?: number }): Promise<ChatResult>;
}

/** Convenience umbrella used by the composition root. */
export interface IAiProvider extends IEmbeddingProvider, ISummarizationProvider, IChatProvider {}
