import { parseJsonArray, parseJsonRecord, parseNumberArray } from '../../core/json';
import type {
  Announcement,
  Community,
  EmbeddingRecord,
  Event,
  EventMode,
  ContentStatus,
  IndexableEntityType,
  Interaction,
  Post,
  Profile,
  Project,
  Report,
  ReportReason,
  ReportStatus,
  Resource,
} from '../../domain/entities/models';

/**
 * Prisma row -> domain model mappers.
 *
 * All JSON-string decoding happens here exactly once, so repositories stay
 * thin and no service ever has to know that SQLite stores arrays as text (DRY).
 */
export const Mappers = {
  profile(row: any): Profile {
    return {
      id: row.id,
      userId: row.userId,
      name: row.user?.name ?? '',
      email: row.user?.email ?? '',
      avatarUrl: row.user?.avatarUrl ?? null,
      headline: row.headline,
      bio: row.bio,
      location: row.location,
      availability: row.availability,
      skills: parseJsonArray(row.skills),
      interests: parseJsonArray(row.interests),
      expertise: parseJsonArray(row.expertise),
      links: parseJsonRecord<Record<string, string>>(row.links, {}),
      experienceYrs: row.experienceYrs,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  community(row: any): Community {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      category: row.category,
      tags: parseJsonArray(row.tags),
      location: row.location,
      isPublic: row.isPublic,
      memberCount: row._count?.memberships ?? row.memberCount ?? 0,
      eventCount: row._count?.events ?? row.eventCount ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  event(row: any): Event {
    return {
      id: row.id,
      communityId: row.communityId,
      communityName: row.community?.name ?? '',
      organizerId: row.organizerId,
      organizerName: row.organizer?.name ?? '',
      title: row.title,
      description: row.description,
      summary: row.summary,
      mode: row.mode as EventMode,
      venue: row.venue,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      capacity: row.capacity,
      tags: parseJsonArray(row.tags),
      bannerUrl: row.bannerUrl ?? '',
      status: row.status as ContentStatus,
      rsvpCount: row._count?.rsvps ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  resource(row: any): Resource {
    return {
      id: row.id,
      communityId: row.communityId,
      communityName: row.community?.name ?? '',
      authorId: row.authorId,
      authorName: row.author?.name ?? '',
      title: row.title,
      description: row.description,
      summary: row.summary,
      url: row.url,
      type: row.type,
      tags: parseJsonArray(row.tags),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  announcement(row: any): Announcement {
    return {
      id: row.id,
      communityId: row.communityId,
      communityName: row.community?.name ?? '',
      authorId: row.authorId,
      authorName: row.author?.name ?? '',
      title: row.title,
      body: row.body,
      summary: row.summary,
      priority: row.priority,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  post(row: any): Post {
    return {
      id: row.id,
      communityId: row.communityId,
      communityName: row.community?.name ?? '',
      authorId: row.authorId,
      authorName: row.author?.name ?? '',
      title: row.title,
      body: row.body,
      summary: row.summary,
      tags: parseJsonArray(row.tags),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  project(row: any): Project {
    return {
      id: row.id,
      ownerId: row.ownerId,
      ownerName: row.owner?.name ?? '',
      title: row.title,
      description: row.description,
      neededSkills: parseJsonArray(row.neededSkills),
      teamSize: row.teamSize,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  report(row: any): Report {
    return {
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      targetTitle: row.targetTitle ?? '',
      reporterId: row.reporterId,
      reporterName: row.reporter?.name ?? '',
      reason: row.reason as ReportReason,
      details: row.details,
      status: row.status as ReportStatus,
      aiVerdict: row.aiVerdict,
      aiScore: row.aiScore,
      aiRationale: row.aiRationale,
      reviewerId: row.reviewerId ?? null,
      resolution: row.resolution,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  embedding(row: any): EmbeddingRecord {
    return {
      id: row.id,
      entityType: row.entityType as IndexableEntityType,
      entityId: row.entityId,
      chunkIndex: row.chunkIndex,
      content: row.content,
      vector: parseNumberArray(row.vector),
      dimension: row.dimension,
      model: row.model,
      metadata: parseJsonRecord<Record<string, unknown>>(row.metadata, {}),
    };
  },

  interaction(row: any): Interaction {
    return {
      id: row.id,
      userId: row.userId ?? null,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      weight: row.weight,
      context: row.context,
      createdAt: row.createdAt,
    };
  },
};
