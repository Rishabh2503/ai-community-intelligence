/**
 * Typed API client.
 *
 * Every network call in the UI goes through `request()`, so authentication
 * headers, JSON handling, base URL and error normalisation exist in exactly
 * one place (DRY). Components never call `fetch` directly.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'community-space-token';
const USER_KEY = 'community-space-user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'MEMBER' | 'ORGANIZER' | 'ADMIN';
  avatarUrl: string | null;
}

export const tokenStore = {
  get: (): string | null => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string, user: AuthUser): void => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  user: (): AuthUser | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    try {
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  },
  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(error?.message ?? 'Request failed', response.status, error?.code ?? 'UNKNOWN');
  }
  return payload as T;
}

// ---------------------------------------------------------------- types

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LiveDiscovery {
  items: { id: string; name: string; url: string; location: string; startsAt: string; endsAt: string; tags: string[] }[];
  total: number;
  regions: string[];
  source: string;
  sourceUrl: string;
  fetchedAt: string | null;
  status: 'live' | 'stale' | 'unavailable';
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
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  location: string;
  memberCount: number;
  eventCount: number;
}

export interface EventItem {
  id: string;
  communityId: string;
  communityName: string;
  organizerName: string;
  title: string;
  description: string;
  summary: string;
  mode: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  tags: string[];
  bannerUrl?: string;
  status: string;
  rsvpCount: number;
}

export interface ResourceItem {
  id: string;
  communityName: string;
  authorName: string;
  title: string;
  description: string;
  summary: string;
  url: string;
  type: string;
  tags: string[];
}

export interface AnnouncementItem {
  id: string;
  communityName: string;
  authorName: string;
  title: string;
  body: string;
  summary: string;
  priority: string;
  createdAt: string;
}

export interface ProjectItem {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  neededSkills: string[];
  teamSize: number;
  status: string;
}

export interface SearchHit {
  entityType: string;
  entityId: string;
  title: string;
  snippet: string;
  score: number;
  matchPercentage: number;
  reasons: string[];
  metadata: Record<string, unknown>;
  entity?: unknown;
}

export interface SearchResponse {
  query: string;
  hits: SearchHit[];
  tookMs: number;
  model: string;
}

export interface AssistantAnswer {
  question: string;
  answer: string;
  sources: { entityType: string; entityId: string; title: string; snippet: string; matchPercentage: number }[];
  followUps: string[];
  provider: string;
  latencyMs: number;
  grounded: boolean;
  answerMode?: 'community' | 'general' | 'unavailable';
}

export interface CogneeAnswer {
  answer: string;
  searchType: string;
  latencyMs: number;
  source: 'cognee' | 'built-in';
  fellBack: boolean;
  reason?: string;
  sources?: AssistantAnswer['sources'];
  grounded?: boolean;
}

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

export interface WebIngestResult {
  url: string;
  title: string;
  wordCount: number;
  resourceId: string;
  summary: string;
  tookMs: number;
}

export interface BannerStyle {
  id: string;
  label: string;
  modifiers: string;
}

export interface GeneratedBanner {
  imageUrl: string;
  prompt: string;
  style: string;
  width: number;
  height: number;
  seed: number;
  provider: string;
}

export interface MatchCandidate {
  profile: Profile;
  score: number;
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
}

export interface ReportItem {
  id: string;
  targetType: string;
  targetId: string;
  targetTitle: string;
  reporterName: string;
  reason: string;
  details: string;
  status: string;
  aiVerdict: string;
  aiScore: number;
  aiRationale: string;
  createdAt: string;
}

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
    recentQuestions: { question: string; topicLabel: string; createdAt: string }[];
    unansweredSignals: string[];
  };
  moderation: { byStatus: Record<string, number>; openCount: number };
  skillSupply: { skill: string; count: number }[];
}

export interface TriageResult {
  verdict: string;
  score: number;
  rationale: string;
  duplicates: { entityType: string; entityId: string; title: string; similarity: number }[];
}

// ------------------------------------------------------------- endpoints

export const api = {
  liveDiscovery: (region = '', q = '') => request<LiveDiscovery>(`/discovery/live?${new URLSearchParams({ region, q })}`),
  health: () => request<{ status: string; aiProvider: string }>('/health'),

  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data: { email: string; password: string; name: string; role?: string }) =>
      request<{ token: string; user: AuthUser }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<AuthUser & { profile: Profile | null }>('/auth/me'),
  },

  profiles: {
    list: (params: { q?: string; skills?: string; availability?: string } = {}) =>
      request<Paginated<Profile>>(`/profiles?${new URLSearchParams(params as Record<string, string>)}`),
    get: (userId: string) => request<Profile>(`/profiles/${userId}`),
    updateMine: (data: Partial<Profile>) => request<Profile>('/profiles/me', { method: 'PUT', body: JSON.stringify(data) }),
  },

  communities: {
    list: (params: { q?: string; location?: string } = {}) =>
      request<Paginated<Community>>(`/communities?${new URLSearchParams(params)}&pageSize=50`),
    get: (id: string) => request<Community>(`/communities/${id}`),
    join: (id: string) => request<{ joined: boolean }>(`/communities/${id}/join`, { method: 'POST' }),
    create: (data: Record<string, unknown>) => request<Community>('/communities', { method: 'POST', body: JSON.stringify(data) }),
  },

  events: {
    list: (params: { q?: string; communityId?: string; upcoming?: string; mode?: string; location?: string } = {}) =>
      request<Paginated<EventItem>>(`/events?${new URLSearchParams(params as Record<string, string>)}&pageSize=50`),
    upcoming: (limit = 12) => request<EventItem[]>(`/events/upcoming?limit=${limit}`),
    get: (id: string) => request<EventItem>(`/events/${id}`),
    create: (data: Record<string, unknown>) => request<EventItem>('/events', { method: 'POST', body: JSON.stringify(data) }),
    rsvp: (id: string, status = 'GOING') =>
      request<{ rsvpCount: number }>(`/events/${id}/rsvp`, { method: 'POST', body: JSON.stringify({ status }) }),
  },

  resources: {
    list: (q = '') => request<Paginated<ResourceItem>>(`/resources?q=${encodeURIComponent(q)}&pageSize=50`),
    create: (data: Record<string, unknown>) => request<ResourceItem>('/resources', { method: 'POST', body: JSON.stringify(data) }),
  },

  announcements: {
    list: (q = '') => request<Paginated<AnnouncementItem>>(`/announcements?q=${encodeURIComponent(q)}&pageSize=50`),
    create: (data: Record<string, unknown>) =>
      request<AnnouncementItem>('/announcements', { method: 'POST', body: JSON.stringify(data) }),
  },

  projects: {
    list: () => request<Paginated<ProjectItem>>('/projects?pageSize=50'),
    create: (data: Record<string, unknown>) => request<ProjectItem>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  },

  ai: {
    search: (q: string, types?: string[], limit = 12) =>
      request<SearchResponse>(
        `/ai/search?q=${encodeURIComponent(q)}&limit=${limit}${types?.length ? `&types=${types.join(',')}` : ''}`,
      ),
    assistant: (question: string) =>
      request<AssistantAnswer>('/ai/assistant', { method: 'POST', body: JSON.stringify({ question }) }),
    recommendations: (intent?: string, types?: string[], limit = 9) =>
      request<{ basis: string; intent: string; items: SearchHit[] }>('/ai/recommendations', {
        method: 'POST',
        body: JSON.stringify({ intent, types, limit }),
      }),
    match: (data: { projectId?: string; requiredSkills?: string[]; description?: string; limit?: number }) =>
      request<{ project: ProjectItem | null; candidates: MatchCandidate[] }>('/ai/match', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    summarize: (text: string, style?: 'brief' | 'bullets') =>
      request<{ summary: string; highlights: string[]; provider: string }>('/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({ text, style }),
      }),
    bannerStyles: () => request<BannerStyle[]>('/ai/banner/styles'),
    banner: (description: string, style?: string, seed?: number) =>
      request<GeneratedBanner>('/ai/banner', { method: 'POST', body: JSON.stringify({ description, style, seed }) }),
  },

  cognee: {
    status: () => request<{ configured: boolean; baseUrl: string; dataset: string }>('/ai/cognee/status'),
    ask: (question: string, searchType?: string) =>
      request<CogneeAnswer>('/ai/cognee/ask', { method: 'POST', body: JSON.stringify({ question, searchType }) }),
    ingest: () => request<{ ingested: number }>('/ai/cognee/ingest', { method: 'POST' }),
  },

  imports: {
    templateUrl: () => `${API_URL}/import/template`,
    excel: async (file: File): Promise<ImportSummary> => {
      const form = new FormData();
      form.append('file', file);
      const token = tokenStore.get();
      const response = await fetch(`${API_URL}/import/excel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Import failed');
      return payload as ImportSummary;
    },
    url: (url: string) => request<WebIngestResult>('/import/url', { method: 'POST', body: JSON.stringify({ url }) }),
  },

  moderation: {
    triage: (data: { entityType: string; title: string; body: string; entityId?: string }) =>
      request<TriageResult>('/moderation/triage', { method: 'POST', body: JSON.stringify(data) }),
    reports: (status?: string) => request<Paginated<ReportItem>>(`/moderation/reports${status ? `?status=${status}` : ''}`),
    report: (data: { targetType: string; targetId: string; targetTitle: string; reason: string; details?: string }) =>
      request<ReportItem>('/moderation/reports', { method: 'POST', body: JSON.stringify(data) }),
    resolve: (id: string, status: string, resolution?: string) =>
      request<ReportItem>(`/moderation/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status, resolution }) }),
  },

  analytics: {
    organizer: () => request<OrganizerAnalytics>('/analytics/organizer'),
  },
};
