import { config, isHuggingFaceEnabled } from '../../config/env';
import { createLogger } from '../../core/logger';
import type { IAiProvider } from '../../domain/services/ai-provider';
import { HuggingFaceAiProvider } from './huggingface-ai.provider';
import { LocalAiProvider } from './local-ai.provider';
import { CachedEmbeddingProvider, ResilientAiProvider } from './resilient-ai.provider';

const logger = createLogger('AiProviderFactory');

/**
 * Factory (composition root helper) that decides which AI stack to build.
 * This is the ONLY place in the codebase that knows a Hugging Face provider
 * exists - everything else programs against `IAiProvider`.
 */
export const createAiProvider = (): IAiProvider => {
  const local = new LocalAiProvider();

  if (!isHuggingFaceEnabled()) {
    logger.info('Using the offline local AI provider (no API key configured).');
    return new CachedEmbeddingProvider(local);
  }

  if (!config.HUGGINGFACE_API_KEY) {
    logger.warn('AI_PROVIDER=huggingface but HUGGINGFACE_API_KEY is empty - falling back to local.');
    return new CachedEmbeddingProvider(local);
  }

  logger.info('Using Hugging Face Inference API with local fallback.', {
    embedding: config.HF_EMBEDDING_MODEL,
    summarization: config.HF_SUMMARIZATION_MODEL,
    chat: config.HF_CHAT_MODEL,
  });

  const huggingFace = new HuggingFaceAiProvider(config.HUGGINGFACE_API_KEY);
  return new CachedEmbeddingProvider(new ResilientAiProvider(huggingFace, local));
};
