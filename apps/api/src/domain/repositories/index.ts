import type {
  Announcement,
  Community,
  EmbeddingRecord,
  Event,
  IndexableEntityType,
  Interaction,
  Post,
  Profile,
  Project,
  Report,
  Resource,
  UserRole,
} from '../entities/models';

/**
 * Repository contracts.
 *
 * Services depend on these interfaces only; the Prisma implementations live in
 * `infrastructure/persistence`. Swapping SQLite for Postgres, Mongo or an
 * in-memory fake for tests requires no change above this line
 * (Dependency Inversion + Open/Closed).
 *
 * The interfaces are deliberately narrow and feature-focused rather than one
 * giant `IRepository` (Interface Segregation).
 */

export interface ListQuery {
  search?: string;
  tags?: string[];
  communityId?: string;
  location?: string;
  page?: number;
  pageSize?: number;
}

/** Shared read/write surface reused by every content repository (DRY). */
export interface ICrudRepository<TEntity, TCreate, TUpdate> {
  findById(id: string): Promise<TEntity | null>;
  findMany(query: ListQuery): Promise<{ items: TEntity[]; total: number }>;
  findByIds(ids: string[]): Promise<TEntity[]>;
  create(data: TCreate): Promise<TEntity>;
  update(id: string, data: TUpdate): Promise<TEntity>;
  delete(id: string): Promise<void>;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl: string | null;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(data: { email: string; name: string; passwordHash: string; role: UserRole }): Promise<UserRecord>;
  count(): Promise<number>;
}

export interface ProfileInput {
  headline?: string;
  bio?: string;
  location?: string;
  availability?: string;
  skills?: string[];
  interests?: string[];
  expertise?: string[];
  links?: Record<string, string>;
  experienceYrs?: number;
}

export interface IProfileRepository {
  findByUserId(userId: string): Promise<Profile | null>;
  findMany(query: ListQuery & { skills?: string[]; availability?: string }): Promise<{ items: Profile[]; total: number }>;
  findByIds(userIds: string[]): Promise<Profile[]>;
  upsert(userId: string, data: ProfileInput): Promise<Profile>;
  listAll(): Promise<Profile[]>;
}

export interface CommunityInput {
  name: string;
  description: string;
  category: string;
  tags?: string[];
  location?: string;
  isPublic?: boolean;
}

export interface ICommunityRepository extends ICrudRepository<Community, CommunityInput, Partial<CommunityInput>> {
  findBySlug(slug: string): Promise<Community | null>;
  addMember(communityId: string, userId: string, role?: string): Promise<void>;
  removeMember(communityId: string, userId: string): Promise<void>;
  isMember(communityId: string, userId: string): Promise<boolean>;
  listForUser(userId: string): Promise<Community[]>;
  listAll(): Promise<Community[]>;
}

export interface EventInput {
  communityId: string;
  organizerId: string;
  title: string;
  description: string;
  summary?: string;
  mode?: string;
  venue?: string;
  startsAt: Date;
  endsAt: Date;
  capacity?: number;
  tags?: string[];
  bannerUrl?: string;
  status?: string;
}

export interface IEventRepository extends ICrudRepository<Event, EventInput, Partial<EventInput>> {
  listUpcoming(limit?: number): Promise<Event[]>;
  listAll(): Promise<Event[]>;
  listByOrganizer(organizerId: string): Promise<Event[]>;
  setRsvp(eventId: string, userId: string, status: string): Promise<void>;
  countRsvps(eventId: string): Promise<number>;
}

export interface ResourceInput {
  communityId: string;
  authorId: string;
  title: string;
  description: string;
  summary?: string;
  url?: string;
  type?: string;
  tags?: string[];
}

export interface IResourceRepository extends ICrudRepository<Resource, ResourceInput, Partial<ResourceInput>> {
  listAll(): Promise<Resource[]>;
}

export interface AnnouncementInput {
  communityId: string;
  authorId: string;
  title: string;
  body: string;
  summary?: string;
  priority?: string;
}

export interface IAnnouncementRepository
  extends ICrudRepository<Announcement, AnnouncementInput, Partial<AnnouncementInput>> {
  listAll(): Promise<Announcement[]>;
}

export interface PostInput {
  communityId: string;
  authorId: string;
  title: string;
  body: string;
  summary?: string;
  tags?: string[];
}

export interface IPostRepository extends ICrudRepository<Post, PostInput, Partial<PostInput>> {
  listAll(): Promise<Post[]>;
}

export interface ProjectInput {
  ownerId: string;
  title: string;
  description: string;
  neededSkills?: string[];
  teamSize?: number;
  status?: string;
}

export interface IProjectRepository extends ICrudRepository<Project, ProjectInput, Partial<ProjectInput>> {
  listAll(): Promise<Project[]>;
}

export interface ReportInput {
  targetType: string;
  targetId: string;
  targetTitle: string;
  reporterId: string;
  reason: string;
  details?: string;
  aiVerdict?: string;
  aiScore?: number;
  aiRationale?: string;
  status?: string;
}

export interface IReportRepository {
  create(data: ReportInput): Promise<Report>;
  findById(id: string): Promise<Report | null>;
  findMany(query: { status?: string; page?: number; pageSize?: number }): Promise<{ items: Report[]; total: number }>;
  updateStatus(id: string, data: { status: string; reviewerId: string; resolution?: string }): Promise<Report>;
  countByStatus(): Promise<Record<string, number>>;
}

export interface EmbeddingUpsertInput {
  entityType: IndexableEntityType;
  entityId: string;
  chunkIndex: number;
  content: string;
  vector: number[];
  model: string;
  metadata?: Record<string, unknown>;
}

export interface IEmbeddingRepository {
  upsertMany(records: EmbeddingUpsertInput[]): Promise<void>;
  deleteForEntity(entityType: IndexableEntityType, entityId: string): Promise<void>;
  findByTypes(types: IndexableEntityType[]): Promise<EmbeddingRecord[]>;
  findForEntity(entityType: IndexableEntityType, entityId: string): Promise<EmbeddingRecord[]>;
  count(): Promise<number>;
}

export interface IInteractionRepository {
  record(data: {
    userId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    weight?: number;
    context?: string;
  }): Promise<void>;
  listByUser(userId: string, limit?: number): Promise<Interaction[]>;
  listRecent(limit?: number): Promise<Interaction[]>;
  countsByEntity(entityType: string): Promise<Record<string, number>>;
  countsByAction(): Promise<Record<string, number>>;
  dailyCounts(days: number): Promise<{ date: string; count: number }[]>;
}

export interface IAssistantQueryRepository {
  record(data: {
    userId?: string | null;
    question: string;
    answer: string;
    sources: unknown[];
    topicLabel: string;
    latencyMs: number;
    provider: string;
  }): Promise<void>;
  listRecent(limit?: number): Promise<{ question: string; topicLabel: string; createdAt: Date }[]>;
  topTopics(limit?: number): Promise<{ topic: string; count: number }[]>;
}
