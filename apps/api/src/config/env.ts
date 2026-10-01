import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Environment is parsed once, validated, and exposed as an immutable object.
 * Nothing else in the codebase reads `process.env` directly -- that keeps
 * configuration concerns in exactly one place (Single Responsibility).
 */
const schema = z.object({
  DATABASE_URL: z.string().default('file:./dev.db'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(8).default('community-space-dev-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AI_PROVIDER: z.enum(['auto', 'huggingface', 'local']).default('auto'),
  HUGGINGFACE_API_KEY: z.string().optional().default(''),
  HF_EMBEDDING_MODEL: z.string().default('sentence-transformers/all-MiniLM-L6-v2'),
  HF_SUMMARIZATION_MODEL: z.string().default('facebook/bart-large-cnn'),
  HF_CHAT_MODEL: z.string().default('meta-llama/Llama-3.1-8B-Instruct'),
  AI_TIMEOUT_MS: z.coerce.number().default(15000),

  // Optional Cognee knowledge-graph memory. Absent key = feature simply stays off.
  COGNEE_API_KEY: z.string().optional().default(''),
  COGNEE_TENANT_ID: z.string().optional().default(''),
  COGNEE_BASE_URL: z.string().optional().default(''),
  COGNEE_DATASET: z.string().default('community_space'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message instead of exploding deep inside a request.
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export type AppConfig = Readonly<z.infer<typeof schema>>;

export const config: AppConfig = Object.freeze(parsed.data);

export const isHuggingFaceEnabled = (): boolean => {
  if (config.AI_PROVIDER === 'local') return false;
  if (config.AI_PROVIDER === 'huggingface') return true;
  return config.HUGGINGFACE_API_KEY.trim().length > 0;
};

export const isCogneeEnabled = (): boolean =>
  config.COGNEE_API_KEY.trim().length > 0 && config.COGNEE_BASE_URL.trim().length > 0;
