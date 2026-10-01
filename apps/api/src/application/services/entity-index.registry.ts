import type { IndexableEntityType } from '../../domain/entities/models';

/**
 * A searchable document: the normalised text that gets embedded plus the
 * metadata needed to render a result card without another database round-trip.
 */
export interface SearchDocument {
  title: string;
  text: string;
  metadata: Record<string, unknown>;
}

/**
 * Strategy that teaches the index how to handle one entity type.
 *
 * Adding a new searchable entity (say "Job") means writing one descriptor and
 * registering it - no existing file changes (Open/Closed).
 */
export interface EntityIndexDescriptor<TEntity = unknown> {
  readonly type: IndexableEntityType;
  loadOne(id: string): Promise<TEntity | null>;
  loadAll(): Promise<TEntity[]>;
  getId(entity: TEntity): string;
  toDocument(entity: TEntity): SearchDocument;
}

export class EntityIndexRegistry {
  private readonly descriptors = new Map<IndexableEntityType, EntityIndexDescriptor<any>>();

  register(descriptor: EntityIndexDescriptor<any>): this {
    this.descriptors.set(descriptor.type, descriptor);
    return this;
  }

  get(type: IndexableEntityType): EntityIndexDescriptor<any> | undefined {
    return this.descriptors.get(type);
  }

  types(): IndexableEntityType[] {
    return [...this.descriptors.keys()];
  }

  all(): EntityIndexDescriptor<any>[] {
    return [...this.descriptors.values()];
  }
}
