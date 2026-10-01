import type { PrismaClient } from '@prisma/client';
import { normalizeList, stringify } from '../../core/json';
import { NotFoundError } from '../../core/errors';
import type { Community } from '../../domain/entities/models';
import type { CommunityInput, ICommunityRepository, ListQuery } from '../../domain/repositories';
import { Mappers } from './mappers';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export class PrismaCommunityRepository implements ICommunityRepository {
  private static readonly include = { _count: { select: { memberships: true, events: true } } } as const;

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Community | null> {
    const row = await this.prisma.community.findUnique({
      where: { id },
      include: PrismaCommunityRepository.include,
    });
    return row ? Mappers.community(row) : null;
  }

  async findBySlug(slug: string): Promise<Community | null> {
    const row = await this.prisma.community.findUnique({
      where: { slug },
      include: PrismaCommunityRepository.include,
    });
    return row ? Mappers.community(row) : null;
  }

  async findByIds(ids: string[]): Promise<Community[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.community.findMany({
      where: { id: { in: ids } },
      include: PrismaCommunityRepository.include,
    });
    return rows.map(Mappers.community);
  }

  async findMany(query: ListQuery): Promise<{ items: Community[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const search = query.search?.trim();

    const where: Record<string, unknown> = {};
    if (query.location?.trim()) where.location = { contains: query.location.split(',')[0].trim() };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { category: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.community.findMany({
        where,
        include: PrismaCommunityRepository.include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.community.count({ where }),
    ]);

    return { items: rows.map(Mappers.community), total };
  }

  async create(data: CommunityInput): Promise<Community> {
    const base = slugify(data.name) || 'community';
    let slug = base;
    let suffix = 1;
    while (await this.prisma.community.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }

    const row = await this.prisma.community.create({
      data: {
        slug,
        name: data.name,
        description: data.description,
        category: data.category,
        tags: stringify(normalizeList(data.tags)),
        location: data.location ?? 'Online',
        isPublic: data.isPublic ?? true,
      },
      include: PrismaCommunityRepository.include,
    });
    return Mappers.community(row);
  }

  async update(id: string, data: Partial<CommunityInput>): Promise<Community> {
    const existing = await this.prisma.community.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Community');

    const row = await this.prisma.community.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.tags !== undefined ? { tags: stringify(normalizeList(data.tags)) } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
      },
      include: PrismaCommunityRepository.include,
    });
    return Mappers.community(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.community.delete({ where: { id } });
  }

  async addMember(communityId: string, userId: string, role = 'MEMBER'): Promise<void> {
    await this.prisma.membership.upsert({
      where: { userId_communityId: { userId, communityId } },
      create: { userId, communityId, role },
      update: { role },
    });
  }

  async removeMember(communityId: string, userId: string): Promise<void> {
    await this.prisma.membership
      .delete({ where: { userId_communityId: { userId, communityId } } })
      .catch(() => undefined);
  }

  async isMember(communityId: string, userId: string): Promise<boolean> {
    const row = await this.prisma.membership.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    return Boolean(row);
  }

  async listForUser(userId: string): Promise<Community[]> {
    const rows = await this.prisma.community.findMany({
      where: { memberships: { some: { userId } } },
      include: PrismaCommunityRepository.include,
    });
    return rows.map(Mappers.community);
  }

  async listAll(): Promise<Community[]> {
    const rows = await this.prisma.community.findMany({ include: PrismaCommunityRepository.include });
    return rows.map(Mappers.community);
  }
}
