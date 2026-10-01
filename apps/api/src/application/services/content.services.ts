import type {
  Announcement,
  Community,
  Event,
  Post,
  Project,
  Resource,
} from '../../domain/entities/models';
import type {
  AnnouncementInput,
  CommunityInput,
  EventInput,
  IAnnouncementRepository,
  ICommunityRepository,
  IEventRepository,
  IInteractionRepository,
  IPostRepository,
  IProjectRepository,
  IResourceRepository,
  PostInput,
  ProjectInput,
  ResourceInput,
} from '../../domain/repositories';
import { IndexedContentService } from './indexed-content.service';
import type { IndexingService } from './indexing.service';
import type { SummarizationService } from './summarization.service';

/**
 * Concrete content services.
 *
 * Each class only declares what makes its entity different - the shared
 * "summarise -> persist -> index" workflow is inherited from
 * `IndexedContentService`.
 */

export class EventService extends IndexedContentService<Event, EventInput, Partial<EventInput>> {
  constructor(
    private readonly events: IEventRepository,
    indexing: IndexingService,
    summarizer: SummarizationService,
    private readonly interactions: IInteractionRepository,
  ) {
    super(events, indexing, summarizer, 'EVENT');
  }

  protected getId(entity: Event): string {
    return entity.id;
  }

  protected getSummarySource(input: Partial<EventInput>): { title: string; body: string } | null {
    if (!input.description) return null;
    return { title: input.title ?? 'Event', body: input.description };
  }

  listUpcoming(limit?: number): Promise<Event[]> {
    return this.events.listUpcoming(limit);
  }

  listByOrganizer(organizerId: string): Promise<Event[]> {
    return this.events.listByOrganizer(organizerId);
  }

  async rsvp(eventId: string, userId: string, status: string): Promise<{ rsvpCount: number }> {
    await this.events.setRsvp(eventId, userId, status);
    await this.interactions.record({ userId, entityType: 'EVENT', entityId: eventId, action: 'RSVP', weight: 3 });
    return { rsvpCount: await this.events.countRsvps(eventId) };
  }
}

export class ResourceService extends IndexedContentService<Resource, ResourceInput, Partial<ResourceInput>> {
  constructor(resources: IResourceRepository, indexing: IndexingService, summarizer: SummarizationService) {
    super(resources, indexing, summarizer, 'RESOURCE');
  }

  protected getId(entity: Resource): string {
    return entity.id;
  }

  protected getSummarySource(input: Partial<ResourceInput>): { title: string; body: string } | null {
    if (!input.description) return null;
    return { title: input.title ?? 'Resource', body: input.description };
  }
}

export class AnnouncementService extends IndexedContentService<
  Announcement,
  AnnouncementInput,
  Partial<AnnouncementInput>
> {
  constructor(announcements: IAnnouncementRepository, indexing: IndexingService, summarizer: SummarizationService) {
    super(announcements, indexing, summarizer, 'ANNOUNCEMENT');
  }

  protected getId(entity: Announcement): string {
    return entity.id;
  }

  protected getSummarySource(input: Partial<AnnouncementInput>): { title: string; body: string } | null {
    if (!input.body) return null;
    return { title: input.title ?? 'Announcement', body: input.body };
  }
}

export class PostService extends IndexedContentService<Post, PostInput, Partial<PostInput>> {
  constructor(posts: IPostRepository, indexing: IndexingService, summarizer: SummarizationService) {
    super(posts, indexing, summarizer, 'POST');
  }

  protected getId(entity: Post): string {
    return entity.id;
  }

  protected getSummarySource(input: Partial<PostInput>): { title: string; body: string } | null {
    if (!input.body) return null;
    return { title: input.title ?? 'Discussion', body: input.body };
  }
}

export class ProjectService extends IndexedContentService<Project, ProjectInput, Partial<ProjectInput>> {
  constructor(
    private readonly projects: IProjectRepository,
    indexing: IndexingService,
    summarizer: SummarizationService,
  ) {
    super(projects, indexing, summarizer, 'PROJECT');
  }

  protected getId(entity: Project): string {
    return entity.id;
  }

  protected getSummarySource(): null {
    return null; // Projects are short by design.
  }

  listAll(): Promise<Project[]> {
    return this.projects.listAll();
  }
}

export class CommunityService extends IndexedContentService<Community, CommunityInput, Partial<CommunityInput>> {
  constructor(
    private readonly communities: ICommunityRepository,
    indexing: IndexingService,
    summarizer: SummarizationService,
    private readonly interactions: IInteractionRepository,
  ) {
    super(communities, indexing, summarizer, 'COMMUNITY');
  }

  protected getId(entity: Community): string {
    return entity.id;
  }

  protected getSummarySource(): null {
    return null; // Community descriptions are already short.
  }

  findBySlug(slug: string): Promise<Community | null> {
    return this.communities.findBySlug(slug);
  }

  async join(communityId: string, userId: string): Promise<void> {
    await this.communities.addMember(communityId, userId);
    await this.interactions.record({
      userId,
      entityType: 'COMMUNITY',
      entityId: communityId,
      action: 'JOIN',
      weight: 4,
    });
  }

  leave(communityId: string, userId: string): Promise<void> {
    return this.communities.removeMember(communityId, userId);
  }

  listForUser(userId: string): Promise<Community[]> {
    return this.communities.listForUser(userId);
  }
}
