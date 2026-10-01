import * as XLSX from 'xlsx';
import { BadRequestError } from '../../core/errors';
import { createLogger } from '../../core/logger';
import type { EventService, ResourceService, AnnouncementService } from './content.services';
import type { ICommunityRepository } from '../../domain/repositories';

const logger = createLogger('Import');

export interface ImportRowResult {
  row: number;
  sheet: string;
  title: string;
  status: 'IMPORTED' | 'SKIPPED';
  reason?: string;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  results: ImportRowResult[];
}

/** One sheet definition: its columns and how to turn a row into an entity. */
interface SheetSpec {
  sheet: string;
  columns: string[];
  example: Record<string, string | number>;
  handle: (row: Record<string, unknown>, context: ImportContext) => Promise<string>;
}

interface ImportContext {
  communityId: string;
  userId: string;
}

const text = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

const tags = (value: unknown): string[] =>
  text(value)
    .split(/[,;|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

/**
 * Excel bulk import.
 *
 * Each sheet is described once by a `SheetSpec`, and both the importer and the
 * downloadable template are generated from those specs - so the template can
 * never drift from what the parser accepts (DRY). Rows are created through the
 * normal content services, which means imported content is summarised by the AI
 * and indexed for semantic search exactly like manually published content.
 */
export class ExcelImportService {
  private readonly specs: SheetSpec[];

  constructor(
    private readonly events: EventService,
    private readonly resources: ResourceService,
    private readonly announcements: AnnouncementService,
    private readonly communities: ICommunityRepository,
  ) {
    this.specs = [
      {
        sheet: 'Events',
        columns: ['title', 'description', 'mode', 'venue', 'startsAt', 'endsAt', 'capacity', 'tags'],
        example: {
          title: 'Intro to Vector Databases',
          description:
            'A hands-on 2 hour workshop covering embeddings, indexing strategies and when a vector database beats plain SQL. Bring a laptop with Docker installed.',
          mode: 'OFFLINE',
          venue: 'COEP Campus, Pune',
          startsAt: '2026-11-14 18:00',
          endsAt: '2026-11-14 20:00',
          capacity: 60,
          tags: 'vector-db, embeddings, workshop',
        },
        handle: async (row, context) => {
          const title = text(row.title);
          const startsAt = ExcelImportService.parseDate(row.startsAt);
          const endsAt = ExcelImportService.parseDate(row.endsAt) ?? startsAt;
          if (!startsAt) throw new Error('startsAt is missing or not a valid date');

          await this.events.create({
            communityId: context.communityId,
            organizerId: context.userId,
            title,
            description: text(row.description),
            mode: text(row.mode) || 'OFFLINE',
            venue: text(row.venue),
            startsAt,
            endsAt: endsAt ?? startsAt,
            capacity: Number(row.capacity) || 50,
            tags: tags(row.tags),
          });
          return title;
        },
      },
      {
        sheet: 'Resources',
        columns: ['title', 'description', 'url', 'type', 'tags'],
        example: {
          title: 'Chunking Strategies for Retrieval',
          description:
            'A written guide comparing fixed-size, sentence-aware and semantic chunking, with measured retrieval quality for each approach.',
          url: 'https://example.com/chunking-guide',
          type: 'GUIDE',
          tags: 'rag, chunking, retrieval',
        },
        handle: async (row, context) => {
          const title = text(row.title);
          await this.resources.create({
            communityId: context.communityId,
            authorId: context.userId,
            title,
            description: text(row.description),
            url: text(row.url),
            type: text(row.type) || 'ARTICLE',
            tags: tags(row.tags),
          });
          return title;
        },
      },
      {
        sheet: 'Announcements',
        columns: ['title', 'body'],
        example: {
          title: 'Mentor applications are open for the winter cohort',
          body:
            'We are looking for mentors for the winter cohort. Mentors commit to two hours a week for six weeks, covering code review and career guidance. Apply by the end of the month.',
        },
        handle: async (row, context) => {
          const title = text(row.title);
          await this.announcements.create({
            communityId: context.communityId,
            authorId: context.userId,
            title,
            body: text(row.body),
          });
          return title;
        },
      },
    ];
  }

  /** Builds the .xlsx template from the same specs the parser uses. */
  async buildTemplate(): Promise<Buffer> {
    const workbook = XLSX.utils.book_new();

    for (const spec of this.specs) {
      const sheet = XLSX.utils.json_to_sheet([spec.example], { header: spec.columns });
      sheet['!cols'] = spec.columns.map((column) => ({ wch: column === 'description' || column === 'body' ? 60 : 22 }));
      XLSX.utils.book_append_sheet(workbook, sheet, spec.sheet);
    }

    const readme = XLSX.utils.aoa_to_sheet([
      ['Community Space — bulk import template'],
      [],
      ['1. Each sheet maps to one content type. Keep the sheet names unchanged.'],
      ['2. Row 1 is the header row. Row 2 holds an example — replace it or delete it.'],
      ['3. Rows with an empty title are skipped.'],
      ['4. tags accept a comma separated list, e.g. "rag, chunking".'],
      ['5. Dates accept "2026-11-14 18:00" or a real Excel date cell.'],
      [],
      ['Everything imported is AI-summarised and indexed for semantic search automatically.'],
    ]);
    readme['!cols'] = [{ wch: 95 }];
    XLSX.utils.book_append_sheet(workbook, readme, 'README');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async import(buffer: Buffer, context: { communityId?: string; userId: string }): Promise<ImportSummary> {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new BadRequestError('That file could not be read as an Excel workbook');
    }

    const communityId = context.communityId ?? (await this.defaultCommunityId());
    const results: ImportRowResult[] = [];

    for (const spec of this.specs) {
      const worksheet = workbook.Sheets[spec.sheet];
      if (!worksheet) continue;

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const title = text(row.title);
        if (!title) {
          results.push({ row: rowNumber, sheet: spec.sheet, title: '', status: 'SKIPPED', reason: 'Missing title' });
          continue;
        }

        try {
          await spec.handle(row, { communityId, userId: context.userId });
          results.push({ row: rowNumber, sheet: spec.sheet, title, status: 'IMPORTED' });
        } catch (error) {
          results.push({
            row: rowNumber,
            sheet: spec.sheet,
            title,
            status: 'SKIPPED',
            reason: error instanceof Error ? error.message : 'Could not import this row',
          });
        }
      }
    }

    if (results.length === 0) {
      throw new BadRequestError(
        `No matching sheets found. Expected at least one of: ${this.specs.map((spec) => spec.sheet).join(', ')}`,
      );
    }

    const imported = results.filter((result) => result.status === 'IMPORTED').length;
    logger.info('Excel import finished', { imported, skipped: results.length - imported });
    return { imported, skipped: results.length - imported, results };
  }

  private async defaultCommunityId(): Promise<string> {
    const { items } = await this.communities.findMany({ page: 1, pageSize: 1 });
    if (items.length === 0) throw new BadRequestError('Create a community before importing content');
    return items[0].id;
  }

  /** Accepts real Excel date cells as well as "2026-11-14 18:00" strings. */
  private static parseDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const raw = text(value);
    if (!raw) return null;
    const parsed = new Date(raw.replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
