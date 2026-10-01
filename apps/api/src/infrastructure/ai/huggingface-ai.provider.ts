import { config } from '../../config/env';
import { createLogger } from '../../core/logger';
import type {
  ChatMessage,
  ChatResult,
  EmbeddingResult,
  IAiProvider,
  SummarizationOptions,
  SummaryResult,
} from '../../domain/services/ai-provider';
import { TextUtils } from '../../core/text-utils';

const logger = createLogger('HuggingFaceAiProvider');

/**
 * Hugging Face Inference API provider (free tier friendly).
 *
 * Only this class knows about HTTP, model names and payload shapes. Services
 * depend on the interfaces, so adding another vendor never ripples upwards.
 */
export class HuggingFaceAiProvider implements IAiProvider {
  public readonly name = 'huggingface';
  public readonly dimension = 384; // all-MiniLM-L6-v2

  constructor(
    private readonly apiKey: string,
    private readonly models = {
      embedding: config.HF_EMBEDDING_MODEL,
      summarization: config.HF_SUMMARIZATION_MODEL,
      chat: config.HF_CHAT_MODEL,
    },
    private readonly timeoutMs = config.AI_TIMEOUT_MS,
  ) {}

  private async request<T>(url: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Hugging Face request failed (${response.status}): ${text.slice(0, 200)}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const raw = await this.request<number[][] | number[][][]>(
      `https://router.huggingface.co/hf-inference/models/${this.models.embedding}/pipeline/feature-extraction`,
      { inputs: texts, options: { wait_for_model: true } },
    );

    // The feature-extraction pipeline returns either sentence embeddings
    // (number[][]) or token embeddings (number[][][]) - mean-pool the latter.
    const vectors: number[][] = (raw as unknown[]).map((entry) => {
      if (Array.isArray(entry) && Array.isArray(entry[0])) {
        const tokens = entry as number[][];
        const dim = tokens[0].length;
        const pooled = new Array<number>(dim).fill(0);
        for (const token of tokens) for (let i = 0; i < dim; i += 1) pooled[i] += token[i];
        return pooled.map((value) => value / tokens.length);
      }
      return entry as number[];
    });

    return {
      vectors,
      model: this.models.embedding,
      dimension: vectors[0]?.length ?? this.dimension,
      provider: this.name,
    };
  }

  async summarize(text: string, options?: SummarizationOptions): Promise<SummaryResult> {
    const input = TextUtils.truncate(text.replace(/\s+/g, ' ').trim(), 3800);
    const raw = await this.request<{ summary_text?: string }[]>(
      `https://router.huggingface.co/hf-inference/models/${this.models.summarization}`,
      {
        inputs: input,
        parameters: { min_length: 40, max_length: 160, truncation: 'only_first' },
        options: { wait_for_model: true },
      },
    );

    const summary = raw?.[0]?.summary_text?.trim();
    if (!summary) throw new Error('Hugging Face summarization returned an empty result');

    const formatted =
      options?.style === 'bullets'
        ? TextUtils.sentences(summary)
            .map((sentence) => `• ${sentence}`)
            .join('\n')
        : summary;

    return { summary: formatted, highlights: TextUtils.keywords(text, 6), provider: this.name };
  }

  async complete(messages: ChatMessage[], options?: { maxTokens?: number; temperature?: number }): Promise<ChatResult> {
    const raw = await this.request<{ choices?: { message?: { content?: string } }[] }>(
      'https://router.huggingface.co/v1/chat/completions',
      {
        model: this.models.chat,
        messages,
        max_tokens: options?.maxTokens ?? 512,
        temperature: options?.temperature ?? 0.2,
      },
    );

    const content = raw?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Hugging Face chat completion returned an empty result');
    logger.debug('chat completion received', { chars: content.length });
    return { content, provider: this.name };
  }
}
