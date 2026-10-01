import type { PrismaClient } from '@prisma/client';
import { TextUtils } from './core/text-utils';
import { AnalyticsService } from './application/services/analytics.service';
import { AssistantService } from './application/services/assistant.service';
import { BannerService } from './application/services/banner.service';
import { AuthService, ProfileService } from './application/services/auth.service';
import {
  AnnouncementService,
  CommunityService,
  EventService,
  PostService,
  ProjectService,
  ResourceService,
} from './application/services/content.services';
import { EntityIndexRegistry } from './application/services/entity-index.registry';
import { ExcelImportService } from './application/services/excel-import.service';
import { WebIngestService } from './application/services/web-ingest.service';
import { LiveDiscoveryService } from './application/services/live-discovery.service';
import { IndexingService } from './application/services/indexing.service';
import { MatchmakingService } from './application/services/matchmaking.service';
import { ModerationService } from './application/services/moderation.service';
import { RecommendationService } from './application/services/recommendation.service';
import { SemanticSearchService } from './application/services/semantic-search.service';
import { SummarizationService } from './application/services/summarization.service';
import type { IAiProvider } from './domain/services/ai-provider';
import { createAiProvider } from './infrastructure/ai/ai-provider.factory';
import { PollinationsChatProvider } from './infrastructure/ai/pollinations-chat.provider';
import { CogneeClient } from './infrastructure/ai/cognee.client';
import { getPrismaClient } from './infrastructure/persistence/prisma-client';
import { PrismaCommunityRepository } from './infrastructure/persistence/community.repository';
import {
  PrismaAnnouncementRepository,
  PrismaPostRepository,
  PrismaProjectRepository,
  PrismaResourceRepository,
} from './infrastructure/persistence/content.repository';
import { PrismaEventRepository } from './infrastructure/persistence/event.repository';
import {
  PrismaAssistantQueryRepository,
  PrismaEmbeddingRepository,
  PrismaInteractionRepository,
  PrismaReportRepository,
} from './infrastructure/persistence/moderation.repository';
import { PrismaProfileRepository, PrismaUserRepository } from './infrastructure/persistence/user.repository';
import { BcryptPasswordHasher, JwtTokenService } from './infrastructure/security/security';
import { createAuthMiddleware } from './interfaces/http/middleware';

/**
 * Composition root.
 *
 * This is the ONLY module allowed to instantiate concrete classes. Every other
 * file receives its collaborators through the constructor, which is what makes
 * the Dependency Inversion Principle real rather than decorative: swap the
 * Prisma repositories or the AI provider here and nothing else changes.
 */
export interface AppContainer {
  prisma: PrismaClient;
  ai: IAiProvider;
  middleware: { auth: ReturnType<typeof createAuthMiddleware> };
  services: {
    auth: AuthService;
    profiles: ProfileService;
    communities: CommunityService;
    events: EventService;
    resources: ResourceService;
    announcements: AnnouncementService;
    posts: PostService;
    projects: ProjectService;
    search: SemanticSearchService;
    assistant: AssistantService;
    recommendations: RecommendationService;
    matchmaking: MatchmakingService;
    moderation: ModerationService;
    analytics: AnalyticsService;
    indexing: IndexingService;
    summarizer: SummarizationService;
    cognee: CogneeClient;
    excelImport: ExcelImportService;
    webIngest: WebIngestService;
    liveDiscovery: LiveDiscoveryService;
    banners: BannerService;
  };
}

const formatDate = (date: Date): string =>
  date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

export const createContainer = (): AppContainer => {
  const prisma = getPrismaClient();
  const ai = createAiProvider();

  // -- infrastructure ------------------------------------------------------
  const users = new PrismaUserRepository(prisma);
  const profiles = new PrismaProfileRepository(prisma);
  const communities = new PrismaCommunityRepository(prisma);
  const events = new PrismaEventRepository(prisma);
  const resources = new PrismaResourceRepository(prisma);
  const announcements = new PrismaAnnouncementRepository(prisma);
  const posts = new PrismaPostRepository(prisma);
  const projects = new PrismaProjectRepository(prisma);
  const reports = new PrismaReportRepository(prisma);
  const embeddings = new PrismaEmbeddingRepository(prisma);
  const interactions = new PrismaInteractionRepository(prisma);
  const assistantQueries = new PrismaAssistantQueryRepository(prisma);

  const hasher = new BcryptPasswordHasher();
  const tokens = new JwtTokenService();

  // -- search index strategies --------------------------------------------
  // Each descriptor teaches the index how to read and describe one entity.
  const registry = new EntityIndexRegistry()
    .register({
      type: 'EVENT',
      loadOne: (id) => events.findById(id),
      loadAll: () => events.listAll(),
      getId: (event) => event.id,
      toDocument: (event) => ({
        title: event.title,
        text: [
          event.summary || event.description,
          `Mode: ${event.mode}. Venue: ${event.venue}.`,
          `Starts: ${formatDate(event.startsAt)}. Ends: ${formatDate(event.endsAt)}.`,
          `Hosted by ${event.communityName}, organised by ${event.organizerName}.`,
          `Topics: ${event.tags.join(', ')}.`,
        ].join(' '),
        metadata: {
          kind: 'event',
          communityId: event.communityId,
          communityName: event.communityName,
          startsAt: event.startsAt,
          mode: event.mode,
          venue: event.venue,
          tags: event.tags,
          summary: event.summary,
        },
      }),
    })
    .register({
      type: 'RESOURCE',
      loadOne: (id) => resources.findById(id),
      loadAll: () => resources.listAll(),
      getId: (resource) => resource.id,
      toDocument: (resource) => ({
        title: resource.title,
        text: `${resource.summary || resource.description} Type: ${resource.type}. Shared in ${resource.communityName} by ${resource.authorName}. Topics: ${resource.tags.join(', ')}.`,
        metadata: {
          kind: 'resource',
          communityId: resource.communityId,
          communityName: resource.communityName,
          url: resource.url,
          type: resource.type,
          tags: resource.tags,
          summary: resource.summary,
        },
      }),
    })
    .register({
      type: 'ANNOUNCEMENT',
      loadOne: (id) => announcements.findById(id),
      loadAll: () => announcements.listAll(),
      getId: (announcement) => announcement.id,
      toDocument: (announcement) => ({
        title: announcement.title,
        text: `${announcement.body} Priority: ${announcement.priority}. Posted in ${announcement.communityName} by ${announcement.authorName}.`,
        metadata: {
          kind: 'announcement',
          communityId: announcement.communityId,
          communityName: announcement.communityName,
          priority: announcement.priority,
          summary: announcement.summary,
        },
      }),
    })
    .register({
      type: 'POST',
      loadOne: (id) => posts.findById(id),
      loadAll: () => posts.listAll(),
      getId: (post) => post.id,
      toDocument: (post) => ({
        title: post.title,
        text: `${post.body} Discussion in ${post.communityName} started by ${post.authorName}. Topics: ${post.tags.join(', ')}.`,
        metadata: {
          kind: 'post',
          communityId: post.communityId,
          communityName: post.communityName,
          tags: post.tags,
          summary: post.summary,
        },
      }),
    })
    .register({
      type: 'COMMUNITY',
      loadOne: (id) => communities.findById(id),
      loadAll: () => communities.listAll(),
      getId: (community) => community.id,
      toDocument: (community) => ({
        title: community.name,
        text: `${community.description} Category: ${community.category}. Based in ${community.location}. Topics: ${community.tags.join(', ')}. ${community.memberCount} members.`,
        metadata: {
          kind: 'community',
          slug: community.slug,
          category: community.category,
          location: community.location,
          tags: community.tags,
          memberCount: community.memberCount,
        },
      }),
    })
    .register({
      type: 'PROFILE',
      loadOne: (userId) => profiles.findByUserId(userId),
      loadAll: () => profiles.listAll(),
      getId: (profile) => profile.userId,
      toDocument: (profile) => ({
        title: profile.name || profile.headline || 'Community member',
        text: `${profile.headline}. ${profile.bio} Skills: ${profile.skills.join(', ')}. Expertise: ${profile.expertise.join(', ')}. Interests: ${profile.interests.join(', ')}. Based in ${profile.location}. Availability: ${profile.availability}. ${profile.experienceYrs} years of experience.`,
        metadata: {
          kind: 'profile',
          userId: profile.userId,
          headline: profile.headline,
          skills: profile.skills,
          expertise: profile.expertise,
          availability: profile.availability,
          location: profile.location,
        },
      }),
    })
    .register({
      type: 'PROJECT',
      loadOne: (id) => projects.findById(id),
      loadAll: () => projects.listAll(),
      getId: (project) => project.id,
      toDocument: (project) => ({
        title: project.title,
        text: `${project.description} Looking for: ${project.neededSkills.join(', ')}. Team size: ${project.teamSize}. Status: ${project.status}. Owner: ${project.ownerName}.`,
        metadata: {
          kind: 'project',
          ownerId: project.ownerId,
          ownerName: project.ownerName,
          neededSkills: project.neededSkills,
          teamSize: project.teamSize,
          status: project.status,
        },
      }),
    });

  // -- application services ------------------------------------------------
  const indexing = new IndexingService(registry, embeddings, ai);
  const summarizer = new SummarizationService(ai);
  const search = new SemanticSearchService(embeddings, ai, registry, interactions);

  const eventService = new EventService(events, indexing, summarizer, interactions);
  const resourceService = new ResourceService(resources, indexing, summarizer);
  const announcementService = new AnnouncementService(announcements, indexing, summarizer);

  const services: AppContainer['services'] = {
    auth: new AuthService(users, profiles, hasher, tokens, indexing),
    profiles: new ProfileService(profiles, indexing),
    communities: new CommunityService(communities, indexing, summarizer, interactions),
    events: eventService,
    resources: resourceService,
    announcements: announcementService,
    posts: new PostService(posts, indexing, summarizer),
    projects: new ProjectService(projects, indexing, summarizer),
    search,
    assistant: new AssistantService(search, ai, assistantQueries, new PollinationsChatProvider()),
    recommendations: new RecommendationService(search, profiles, interactions, embeddings, ai),
    matchmaking: new MatchmakingService(profiles, projects, ai),
    moderation: new ModerationService(reports, embeddings, ai),
    analytics: new AnalyticsService(
      communities,
      events,
      resources,
      announcements,
      profiles,
      interactions,
      assistantQueries,
      reports,
      embeddings,
    ),
    indexing,
    summarizer,
    cognee: new CogneeClient(),
    excelImport: new ExcelImportService(eventService, resourceService, announcementService, communities),
    webIngest: new WebIngestService(resourceService, communities),
    liveDiscovery: new LiveDiscoveryService(),
    banners: new BannerService(),
  };

  return {
    prisma,
    ai,
    middleware: { auth: createAuthMiddleware(tokens) },
    services,
  };
};

export const truncateForLog = TextUtils.truncate;
