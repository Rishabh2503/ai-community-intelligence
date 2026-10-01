import { BadRequestError } from '../../core/errors';
import { createLogger } from '../../core/logger';
import { TextUtils } from '../../core/text-utils';
import type { ResourceService } from './content.services';
import type { ICommunityRepository } from '../../domain/repositories';

const logger = createLogger('WebIngest');

export interface ScrapedPage {
  url: string;
  title: string;
  text: string;
  wordCount: number;
}

export interface WebIngestResult {
  url: string;
  title: string;
  wordCount: number;
  resourceId: string;
  summary: string;
  tookMs: number;
}

/**
 * Live web ingestion for the RAG assistant.
 *
 * Fetches a public page, strips it to readable text, then stores it through the
 * normal ResourceService - which means it is summarised by the AI and pushed
 * into the vector index by the same pipeline as everything else. The assistant
 * can cite a page seconds after it is added, with no re-index step (DRY: one
 * publish workflow, many sources).
 */
export class WebIngestService {
  private static readonly MAX_BYTES = 2_000_000;
  private static readonly MIN_WORDS = 40;

  constructor(
    private readonly resources: ResourceService,
    private readonly communities: ICommunityRepository,
    private readonly timeoutMs = 15000,
  ) {}

  async ingest(url: string, options: { userId: string; communityId?: string }): Promise<WebIngestResult> {
    const started = Date.now();
    const page = await this.scrape(url);

    if (page.wordCount < WebIngestService.MIN_WORDS) {
      throw new BadRequestError(
        `Only ${page.wordCount} words of readable text were found at that URL. It may be a JavaScript-rendered page.`,
      );
    }

    const communityId = options.communityId ?? (await this.defaultCommunityId());
    const resource = await this.resources.create({
      communityId,
      authorId: options.userId,
      title: page.title,
      description: page.text,
      url: page.url,
      type: 'WEB',
      tags: ['web-import', ...TextUtils.keywords(page.text, 4)],
    });

    logger.info('Ingested web page', { url: page.url, words: page.wordCount });

    return {
      url: page.url,
      title: page.title,
      wordCount: page.wordCount,
      resourceId: (resource as { id: string }).id,
      summary: (resource as { summary?: string }).summary ?? '',
      tookMs: Date.now() - started,
    };
  }

  /** Fetch + readability-style extraction. No headless browser, so it stays fast. */
  async scrape(rawUrl: string): Promise<ScrapedPage> {
    let url: URL;
    try {
      url = new URL(rawUrl.trim());
    } catch {
      throw new BadRequestError('That is not a valid URL');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new BadRequestError('Only http and https URLs are supported');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': 'CommunitySpaceBot/1.0 (+knowledge-assistant)', Accept: 'text/html,*/*' },
      });
      if (!response.ok) throw new BadRequestError(`The page returned ${response.status}`);

      const html = (await response.text()).slice(0, WebIngestService.MAX_BYTES);
      const title = WebIngestService.extractTitle(html) || url.hostname;
      const text = WebIngestService.extractText(html);

      return { url: url.toString(), title, text, wordCount: text.split(/\s+/).filter(Boolean).length };
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      const reason = error instanceof Error && error.name === 'AbortError' ? 'timed out' : 'could not be reached';
      throw new BadRequestError(`That page ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private static extractTitle(html: string): string {
    const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
    if (og?.[1]) return WebIngestService.decode(og[1]).trim();
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (title?.[1]) return WebIngestService.decode(title[1]).replace(/\s+/g, ' ').trim().slice(0, 180);
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    return h1?.[1] ? WebIngestService.decode(WebIngestService.stripTags(h1[1])).trim().slice(0, 180) : '';
  }

  private static extractText(html: string): string {
    const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;

    const cleaned = body
      // Drop everything that never contains readable prose.
      .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      // Keep block boundaries so sentences do not run together.
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');

    return WebIngestService.decode(WebIngestService.stripTags(cleaned))
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      // Navigation links and button labels are short; real prose is not.
      .filter((line) => line.length > 40)
      .join('\n')
      .slice(0, 20000);
  }

  private static stripTags(value: string): string {
    return value.replace(/<[^>]+>/g, ' ');
  }

  private static decode(value: string): string {
    const named: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
      mdash: '—',
      ndash: '–',
      rsquo: '’',
      lsquo: '‘',
      ldquo: '“',
      rdquo: '”',
    };
    return value
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&([a-z]+);/gi, (match, entity) => named[entity.toLowerCase()] ?? match);
  }

  private async defaultCommunityId(): Promise<string> {
    const { items } = await this.communities.findMany({ page: 1, pageSize: 1 });
    if (items.length === 0) throw new BadRequestError('Create a community before importing web content');
    return items[0].id;
  }
}
