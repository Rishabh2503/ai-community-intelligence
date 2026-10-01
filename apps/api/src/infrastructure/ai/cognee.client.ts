import { config, isCogneeEnabled } from '../../config/env';
import { createLogger } from '../../core/logger';

const logger = createLogger('Cognee');

export interface CogneeAnswer {
  answer: string;
  searchType: string;
  raw: unknown;
  latencyMs: number;
}

export interface CogneeStatus {
  configured: boolean;
  baseUrl: string;
  dataset: string;
}

/**
 * Optional Cognee knowledge-graph memory.
 *
 * Cognee builds an entity/relationship graph over ingested text and answers
 * questions by traversing it, which is a different retrieval strategy from the
 * vector search used elsewhere in this platform. It is exposed as an *opt-in*
 * second opinion: if the key is missing or the call fails, the caller falls
 * back to the built-in assistant, so the product keeps working either way.
 *
 * REST shape (Cognee Cloud):
 *   POST {base}/add      { data, datasetName }
 *   POST {base}/cognify  { datasets }
 *   POST {base}/search   { query, searchType, datasets }
 * Auth headers: X-Api-Key and (optionally) X-Tenant-Id.
 */
export class CogneeClient {
  private readonly baseUrl = CogneeClient.normaliseBaseUrl(config.COGNEE_BASE_URL);
  private readonly dataset = config.COGNEE_DATASET;

  /** Accepts a bare tenant host and appends the API prefix so either form works. */
  private static normaliseBaseUrl(raw: string): string {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    return /\/api\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
  }

  get configured(): boolean {
    return isCogneeEnabled();
  }

  status(): CogneeStatus {
    return { configured: this.configured, baseUrl: this.baseUrl, dataset: this.dataset };
  }

  private headers(): Record<string, string> {
    // Cognee rejects the request with "Invalid header" if an Authorization
    // header is also present, so the API key is sent on X-Api-Key only.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': config.COGNEE_API_KEY,
    };
    if (config.COGNEE_TENANT_ID) headers['X-Tenant-Id'] = config.COGNEE_TENANT_ID;
    return headers;
  }

  private async post(path: string, body: unknown, timeoutMs = config.AI_TIMEOUT_MS): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Cognee ${path} failed (${response.status}): ${text.slice(0, 200)}`);
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** Pushes community text into Cognee and builds the graph. */
  async ingest(documents: string[]): Promise<{ ingested: number }> {
    if (!this.configured) throw new Error('Cognee is not configured');

    // /add is multipart: documents are uploaded as files, not JSON.
    const form = new FormData();
    documents.forEach((document, index) => {
      form.append('data', new Blob([document], { type: 'text/plain' }), `community-${index + 1}.txt`);
    });
    form.append('datasetName', this.dataset);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180000);
    try {
      const response = await fetch(`${this.baseUrl}/add`, {
        method: 'POST',
        headers: { 'X-Api-Key': config.COGNEE_API_KEY },
        body: form,
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Cognee /add failed (${response.status}): ${text.slice(0, 200)}`);
    } finally {
      clearTimeout(timer);
    }

    await this.post('/cognify', { datasets: [this.dataset] }, 180000);
    logger.info('Ingested documents into Cognee', { count: documents.length });
    return { ingested: documents.length };
  }

  async search(query: string, searchType = 'GRAPH_COMPLETION'): Promise<CogneeAnswer> {
    if (!this.configured) throw new Error('Cognee is not configured');
    const started = Date.now();
    // Graph completion runs an LLM over the traversal, so it needs a longer
    // budget than the local providers.
    const raw = await this.post('/search', { query, searchType, datasets: [this.dataset] }, 60000);
    return { answer: CogneeClient.flatten(raw), searchType, raw, latencyMs: Date.now() - started };
  }

  /**
   * Cognee returns a list whose items may be strings or objects depending on
   * the search type, so the response is normalised to readable prose here
   * rather than in the UI.
   */
  private static flatten(payload: unknown): string {
    const pick = (value: unknown): string => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.map(pick).filter(Boolean).join('\n\n');
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        for (const key of ['search_result', 'answer', 'text', 'content', 'result', 'value']) {
          const nested = record[key];
          if (typeof nested === 'string') return nested;
          if (Array.isArray(nested)) return pick(nested);
        }
        return JSON.stringify(record);
      }
      return '';
    };

    const flattened = pick(payload).trim();
    return flattened || 'Cognee returned no content for this question.';
  }
}
