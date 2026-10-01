import type { IndexableEntityType, Paginated } from '../../domain/entities/models';
import type { ICrudRepository, ListQuery } from '../../domain/repositories';
import type { IndexingService } from './indexing.service';
import type { SummarizationService } from './summarization.service';

/**
 * Template Method base class for every publishable content type
 * (events, resources, announcements, posts, projects).
 *
 * The create/update/delete workflow is identical for all of them:
 *   1. generate an AI summary of the long text
 *   2. persist through the repository
 *   3. refresh the semantic index
 * Writing it once here removes five copies of the same orchestration (DRY),
 * while subclasses only describe what is unique about their entity.
 */
export abstract class IndexedContentService<TEntity, TCreate extends object, TUpdate extends object> {
  protected constructor(
    protected readonly repository: ICrudRepository<TEntity, TCreate, TUpdate>,
    protected readonly indexing: IndexingService,
    protected readonly summarizer: SummarizationService,
    protected readonly entityType: IndexableEntityType,
  ) {}

  /** Entity id, used to trigger indexing. */
  protected abstract getId(entity: TEntity): string;

  /** Long text that should be condensed into `summary`. */
  protected abstract getSummarySource(input: Partial<TCreate & TUpdate>): { title: string; body: string } | null;

  async list(query: ListQuery): Promise<Paginated<TEntity>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const { items, total } = await this.repository.findMany({ ...query, page, pageSize });
    return { items, total, page, pageSize };
  }

  async getById(id: string): Promise<TEntity | null> {
    return this.repository.findById(id);
  }

  async create(input: TCreate): Promise<TEntity> {
    const withSummary = await this.withSummary(input);
    const entity = await this.repository.create(withSummary);
    await this.indexing.indexEntity(this.entityType, this.getId(entity));
    return entity;
  }

  async update(id: string, input: TUpdate): Promise<TEntity> {
    const withSummary = await this.withSummary(input);
    const entity = await this.repository.update(id, withSummary);
    await this.indexing.indexEntity(this.entityType, this.getId(entity));
    return entity;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
    await this.indexing.removeEntity(this.entityType, id);
  }

  /** Hook: adds an AI generated summary when the payload carries long text. */
  private async withSummary<T extends object>(input: T): Promise<T> {
    const source = this.getSummarySource(input as never);
    if (!source || !source.body || source.body.length < 280) return input;
    const summary = await this.summarizer.summaryFor(source.title, source.body);
    return { ...input, summary };
  }
}
