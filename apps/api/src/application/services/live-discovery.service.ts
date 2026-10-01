import { z } from 'zod';

const FEED = 'https://developers.events/all-events.json';
const eventSchema = z.object({
  name: z.string(), date: z.array(z.number().finite()).min(1), hyperlink: z.string().url(),
  location: z.string(), city: z.string().optional(), country: z.string().optional(),
  status: z.string().optional(), tags: z.array(z.string()).optional(),
});

export interface LiveEvent {
  id: string;
  name: string;
  url: string;
  location: string;
  startsAt: string;
  endsAt: string;
  tags: string[];
}

const normalize = (value: string) => value.toLowerCase().trim()
  .replace(/bangalore/g, 'bengaluru').replace(/gurgaon/g, 'gurugram').replace(/new delhi/g, 'delhi');

export function matchesRegion(location: string, region: string): boolean {
  const parts = normalize(region).split(',').map((part) => part.trim()).filter(Boolean);
  return parts.every((part) => normalize(location).includes(part));
}

export class LiveDiscoveryService {
  private cache?: { items: LiveEvent[]; fetchedAt: string; expiresAt: number };
  private pending?: Promise<void>;
  private retryAfter = 0;

  private async refresh(): Promise<void> {
    const response = await fetch(FEED, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Event source unavailable');
    const records: unknown = await response.json();
    if (!Array.isArray(records)) throw new Error('Invalid event feed');
    const unique = new Map<string, LiveEvent>();
    for (const record of records) {
      const result = eventSchema.safeParse(record);
      if (!result.success) continue;
      const event = result.data;
      if (!['https:', 'http:'].includes(new URL(event.hyperlink).protocol)) continue;
      if (/cancel/i.test(event.status ?? '')) continue;
      const dates = [...event.date].sort((left, right) => left - right);
      if (dates.some((date) => !Number.isFinite(new Date(date).getTime()))) continue;
      const id = `${event.hyperlink}:${dates[0]}`;
      unique.set(id, {
        id, name: event.name, url: event.hyperlink,
        location: [event.city, event.country].filter(Boolean).join(', ') || event.location,
        startsAt: new Date(dates[0]).toISOString(), endsAt: new Date(dates[dates.length - 1]).toISOString(),
        tags: event.tags ?? [],
      });
    }
    if (!unique.size) throw new Error('Empty event feed');
    this.cache = { items: [...unique.values()], fetchedAt: new Date().toISOString(), expiresAt: Date.now() + 3600000 };
  }

  async discover(region = '', query = '') {
    let stale = false;
    if ((!this.cache || this.cache.expiresAt <= Date.now()) && Date.now() >= this.retryAfter) {
      this.pending ??= this.refresh().finally(() => { this.pending = undefined; });
      try { await this.pending; } catch { this.retryAfter = Date.now() + 60000; stale = true; }
    }
    stale ||= !this.cache || this.cache.expiresAt <= Date.now();
    const today = new Date().setUTCHours(0, 0, 0, 0);
    const upcoming = (this.cache?.items ?? []).filter((event) => Date.parse(event.endsAt) >= today);
    const items = upcoming.filter((event) => matchesRegion(event.location, region)
      && normalize(`${event.name} ${event.location} ${event.tags.join(' ')}`).includes(normalize(query)))
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
    return {
      items: items.slice(0, 60), total: items.length,
      regions: [...new Set(upcoming.map((event) => event.location))].sort(),
      source: 'Developers.events', sourceUrl: 'https://developers.events',
      fetchedAt: this.cache?.fetchedAt ?? null, status: !this.cache ? 'unavailable' : stale ? 'stale' : 'live',
    };
  }
}