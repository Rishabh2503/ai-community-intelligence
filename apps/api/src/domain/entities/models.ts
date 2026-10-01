/**
 * Domain models.
 *
 * These are plain, framework-free shapes. Prisma rows are mapped into them by
 * the persistence layer, so services and controllers never see database
 * details such as JSON-encoded arrays.
 */

export type UserRole = 'MEMBER' | 'ORGANIZER' | 'ADMIN';
export type EventMode = 'ONLINE' | 'OFFLINE' | 'HYBRID';
export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
export type ReportReason = 'SPAM' | 'MISLEADING' | 'DUPLICATE' | 'INAPPROPRIATE' | 'OTHER';

/** Every entity that participates in the semantic index. */
export type IndexableEntityType =
  | 'EVENT'
  | 'RESOURCE'
  | 'ANNOUNCEMENT'
  | 'POST'
  | 'COMMUNITY'
  | 'PROFILE'
  | 'PROJECT';

export const INDEXABLE_ENTITY_TYPES: IndexableEntityType[] = [
  'EVENT',
  'RESOURCE',
  'ANNOUNCEMENT',
  'POST',
  'COMMUNITY',
  'PROFILE',
  'PROJECT',
];

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  headline: string;
  bio: string;
  location: string;
  availability: string;
  skills: string[];
  interests: string[];
  expertise: string[];
  links: Record<string, string>;
  experienceYrs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  location: string;
  isPublic: boolean;
  memberCount: number;
  eventCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Event {
  id: string;
  communityId: string;
  communityName: string;
  organizerId: string;
  organizerName: string;
  title: string;
  description: string;
  summary: string;
  mode: EventMode;
  venue: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  tags: string[];
  bannerUrl: string;
  status: ContentStatus;
  rsvpCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Resource {
  id: string;
  communityId: string;
  communityName: string;
  authorId: string;
  authorName: string;
  title: string;
  description: string;
  summary: string;
  url: string;
  type: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Announcement {
  id: string;
  communityId: string;
  communityName: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  summary: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  communityId: string;
  communityName: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  summary: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  neededSkills: string[];
  teamSize: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: string;
  targetType: string;
  targetId: string;
  targetTitle: string;
  reporterId: string;
  reporterName: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  aiVerdict: string;
  aiScore: number;
  aiRationale: string;
  reviewerId: string | null;
  resolution: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddingRecord {
  id: string;
  entityType: IndexableEntityType;
  entityId: string;
  chunkIndex: number;
  content: string;
  vector: number[];
  dimension: number;
  model: string;
  metadata: Record<string, unknown>;
}

export interface Interaction {
  id: string;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  weight: number;
  context: string;
  createdAt: Date;
}

/** Uniform shape returned by search, recommendations and matching. */
export interface ScoredItem<T> {
  item: T;
  score: number;
  matchPercentage: number;
  reasons: string[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
