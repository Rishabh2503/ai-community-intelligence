import type { PrismaClient } from '@prisma/client';
import { normalizeList, stringify } from '../../core/json';
import { NotFoundError } from '../../core/errors';
import type { Event } from '../../domain/entities/models';
import type { EventInput, IEventRepository, ListQuery } from '../../domain/repositories';
import { Mappers } from './mappers';

export class PrismaEventRepository implements IEventRepository {
  private static readonly include = {
    community: true,
    organizer: true,
    _count: { select: { rsvps: true } },
  } as const;

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Event | null> {
    const row = await this.prisma.event.findUnique({ where: { id }, include: PrismaEventRepository.include });
    return row ? Mappers.event(row) : null;
  }

  async findByIds(ids: string[]): Promise<Event[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.event.findMany({
      where: { id: { in: ids } },
      include: PrismaEventRepository.include,
    });
    return rows.map(Mappers.event);
  }

  async findMany(query: ListQuery & { mode?: string; upcomingOnly?: boolean }): Promise<{ items: Event[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const search = query.search?.trim();

    const where: Record<string, unknown> = {};
    if (query.communityId) where.communityId = query.communityId;
    if (query.mode) where.mode = query.mode;
    if (query.upcomingOnly) where.startsAt = { gte: new Date() };
    if (query.location?.trim()) {
      const location = query.location.split(',')[0].trim();
      where.AND = [{ OR: [{ venue: { contains: location } }, { community: { location: { contains: location } } }] }];
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
        { venue: { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: PrismaEventRepository.include,
        orderBy: { startsAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { items: rows.map(Mappers.event), total };
  }

  async create(data: EventInput): Promise<Event> {
    const row = await this.prisma.event.create({
      data: {
        communityId: data.communityId,
        organizerId: data.organizerId,
        title: data.title,
        description: data.description,
        summary: data.summary ?? '',
        mode: data.mode ?? 'ONLINE',
        venue: data.venue ?? 'Online',
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        capacity: data.capacity ?? 100,
        tags: stringify(normalizeList(data.tags)),
        bannerUrl: data.bannerUrl ?? '',
        status: data.status ?? 'PUBLISHED',
      },
      include: PrismaEventRepository.include,
    });
    return Mappers.event(row);
  }

  async update(id: string, data: Partial<EventInput>): Promise<Event> {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Event');

    const row = await this.prisma.event.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.mode !== undefined ? { mode: data.mode } : {}),
        ...(data.venue !== undefined ? { venue: data.venue } : {}),
        ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
        ...(data.endsAt !== undefined ? { endsAt: data.endsAt } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.tags !== undefined ? { tags: stringify(normalizeList(data.tags)) } : {}),
        ...(data.bannerUrl !== undefined ? { bannerUrl: data.bannerUrl } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: PrismaEventRepository.include,
    });
    return Mappers.event(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.event.delete({ where: { id } });
  }

  async listUpcoming(limit = 20): Promise<Event[]> {
    const rows = await this.prisma.event.findMany({
      where: { startsAt: { gte: new Date() }, status: 'PUBLISHED' },
      include: PrismaEventRepository.include,
      orderBy: { startsAt: 'asc' },
      take: limit,
    });
    return rows.map(Mappers.event);
  }

  async listAll(): Promise<Event[]> {
    const rows = await this.prisma.event.findMany({ include: PrismaEventRepository.include });
    return rows.map(Mappers.event);
  }

  async listByOrganizer(organizerId: string): Promise<Event[]> {
    const rows = await this.prisma.event.findMany({
      where: { organizerId },
      include: PrismaEventRepository.include,
      orderBy: { startsAt: 'desc' },
    });
    return rows.map(Mappers.event);
  }

  async setRsvp(eventId: string, userId: string, status: string): Promise<void> {
    await this.prisma.rsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status },
      update: { status },
    });
  }

  countRsvps(eventId: string): Promise<number> {
    return this.prisma.rsvp.count({ where: { eventId, status: { not: 'CANCELLED' } } });
  }
}
