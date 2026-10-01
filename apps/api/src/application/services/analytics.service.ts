import type {
  IAnnouncementRepository,
  IAssistantQueryRepository,
  ICommunityRepository,
  IEmbeddingRepository,
  IEventRepository,
  IInteractionRepository,
  IProfileRepository,
  IReportRepository,
  IResourceRepository,
} from '../../domain/repositories';

export interface OrganizerAnalytics {
  totals: {
    communities: number;
    events: number;
    resources: number;
    announcements: number;
    members: number;
    indexedChunks: number;
  };
  engagement: {
    byAction: Record<string, number>;
    daily: { date: string; count: number }[];
    topEvents: { id: string; title: string; rsvps: number; interactions: number }[];
  };
  knowledgeDemand: {
    topTopics: { topic: string; count: number }[];
    recentQuestions: { question: string; topicLabel: string; createdAt: Date }[];
    unansweredSignals: string[];
  };
  moderation: {
    byStatus: Record<string, number>;
    openCount: number;
  };
  skillSupply: { skill: string; count: number }[];
}

/**
 * Read-only aggregation for the organizer dashboard.
 * It depends on repository interfaces only, so it never issues its own SQL
 * and cannot accidentally couple the dashboard to the database schema.
 */
export class AnalyticsService {
  constructor(
    private readonly communities: ICommunityRepository,
    private readonly events: IEventRepository,
    private readonly resources: IResourceRepository,
    private readonly announcements: IAnnouncementRepository,
    private readonly profiles: IProfileRepository,
    private readonly interactions: IInteractionRepository,
    private readonly assistantQueries: IAssistantQueryRepository,
    private readonly reports: IReportRepository,
    private readonly embeddings: IEmbeddingRepository,
  ) {}

  async organizerDashboard(): Promise<OrganizerAnalytics> {
    const [communities, events, resources, announcements, profiles] = await Promise.all([
      this.communities.listAll(),
      this.events.listAll(),
      this.resources.listAll(),
      this.announcements.listAll(),
      this.profiles.listAll(),
    ]);

    const [byAction, daily, eventInteractions, topTopics, recentQuestions, reportStats, indexedChunks] =
      await Promise.all([
        this.interactions.countsByAction(),
        this.interactions.dailyCounts(14),
        this.interactions.countsByEntity('EVENT'),
        this.assistantQueries.topTopics(8),
        this.assistantQueries.listRecent(10),
        this.reports.countByStatus(),
        this.embeddings.count(),
      ]);

    const topEvents = [...events]
      .map((event) => ({
        id: event.id,
        title: event.title,
        rsvps: event.rsvpCount,
        interactions: eventInteractions[event.id] ?? 0,
      }))
      .sort((a, b) => b.rsvps + b.interactions - (a.rsvps + a.interactions))
      .slice(0, 5);

    const skillCounts = new Map<string, number>();
    for (const profile of profiles) {
      for (const skill of [...profile.skills, ...profile.expertise]) {
        const key = skill.trim();
        if (!key) continue;
        skillCounts.set(key, (skillCounts.get(key) ?? 0) + 1);
      }
    }

    const skillSupply = [...skillCounts.entries()]
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // Topics people keep asking about that the community has few resources for.
    const resourceText = resources.map((resource) => `${resource.title} ${resource.tags.join(' ')}`.toLowerCase()).join(' ');
    const unansweredSignals = topTopics
      .filter((topic) => topic.topic.split(' ').some((word) => word.length > 3 && !resourceText.includes(word)))
      .map((topic) => topic.topic)
      .slice(0, 5);

    return {
      totals: {
        communities: communities.length,
        events: events.length,
        resources: resources.length,
        announcements: announcements.length,
        members: profiles.length,
        indexedChunks,
      },
      engagement: { byAction, daily, topEvents },
      knowledgeDemand: { topTopics, recentQuestions, unansweredSignals },
      moderation: {
        byStatus: reportStats,
        openCount: (reportStats.PENDING ?? 0) + (reportStats.REVIEWING ?? 0),
      },
      skillSupply,
    };
  }
}
