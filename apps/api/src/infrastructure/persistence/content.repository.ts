import type { PrismaClient } from '@prisma/client';
import { normalizeList, stringify } from '../../core/json';
import { NotFoundError } from '../../core/errors';
import type { Announcement, Post, Project, Resource } from '../../domain/entities/models';
import type {
  AnnouncementInput,
  IAnnouncementRepository,
  IPostRepository,
  IProjectRepository,
  IResourceRepository,
  ListQuery,
  PostInput,
  ProjectInput,
  ResourceInput,
} from '../../domain/repositories';
import { Mappers } from './mappers';

/** Shared pagination maths so each repository does not re-implement it (DRY). */
const paginate = (query: ListQuery) => {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};

export class PrismaResourceRepository implements IResourceRepository {
  private static readonly include = { community: true, author: true } as const;

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Resource | null> {
    const row = await this.prisma.resource.findUnique({ where: { id }, include: PrismaResourceRepository.include });
    return row ? Mappers.resource(row) : null;
  }

  async findByIds(ids: string[]): Promise<Resource[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.resource.findMany({
      where: { id: { in: ids } },
      include: PrismaResourceRepository.include,
    });
    return rows.map(Mappers.resource);
  }

  async findMany(query: ListQuery & { type?: string }): Promise<{ items: Resource[]; total: number }> {
    const { skip, take } = paginate(query);
    const search = query.search?.trim();

    const where: Record<string, unknown> = {};
    if (query.communityId) where.communityId = query.communityId;
    if (query.type) where.type = query.type;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        include: PrismaResourceRepository.include,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.resource.count({ where }),
    ]);
    return { items: rows.map(Mappers.resource), total };
  }

  async create(data: ResourceInput): Promise<Resource> {
    const row = await this.prisma.resource.create({
      data: {
        communityId: data.communityId,
        authorId: data.authorId,
        title: data.title,
        description: data.description,
        summary: data.summary ?? '',
        url: data.url ?? '',
        type: data.type ?? 'ARTICLE',
        tags: stringify(normalizeList(data.tags)),
      },
      include: PrismaResourceRepository.include,
    });
    return Mappers.resource(row);
  }

  async update(id: string, data: Partial<ResourceInput>): Promise<Resource> {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Resource');
    const row = await this.prisma.resource.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.url !== undefined ? { url: data.url } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.tags !== undefined ? { tags: stringify(normalizeList(data.tags)) } : {}),
      },
      include: PrismaResourceRepository.include,
    });
    return Mappers.resource(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.resource.delete({ where: { id } });
  }

  async listAll(): Promise<Resource[]> {
    const rows = await this.prisma.resource.findMany({ include: PrismaResourceRepository.include });
    return rows.map(Mappers.resource);
  }
}

export class PrismaAnnouncementRepository implements IAnnouncementRepository {
  private static readonly include = { community: true, author: true } as const;

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Announcement | null> {
    const row = await this.prisma.announcement.findUnique({
      where: { id },
      include: PrismaAnnouncementRepository.include,
    });
    return row ? Mappers.announcement(row) : null;
  }

  async findByIds(ids: string[]): Promise<Announcement[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.announcement.findMany({
      where: { id: { in: ids } },
      include: PrismaAnnouncementRepository.include,
    });
    return rows.map(Mappers.announcement);
  }

  async findMany(query: ListQuery): Promise<{ items: Announcement[]; total: number }> {
    const { skip, take } = paginate(query);
    const search = query.search?.trim();

    const where: Record<string, unknown> = {};
    if (query.communityId) where.communityId = query.communityId;
    if (search) {
      where.OR = [{ title: { contains: search } }, { body: { contains: search } }];
    }

    const [rows, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        include: PrismaAnnouncementRepository.include,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { items: rows.map(Mappers.announcement), total };
  }

  async create(data: AnnouncementInput): Promise<Announcement> {
    const row = await this.prisma.announcement.create({
      data: {
        communityId: data.communityId,
        authorId: data.authorId,
        title: data.title,
        body: data.body,
        summary: data.summary ?? '',
        priority: data.priority ?? 'NORMAL',
      },
      include: PrismaAnnouncementRepository.include,
    });
    return Mappers.announcement(row);
  }

  async update(id: string, data: Partial<AnnouncementInput>): Promise<Announcement> {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Announcement');
    const row = await this.prisma.announcement.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
      },
      include: PrismaAnnouncementRepository.include,
    });
    return Mappers.announcement(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.announcement.delete({ where: { id } });
  }

  async listAll(): Promise<Announcement[]> {
    const rows = await this.prisma.announcement.findMany({ include: PrismaAnnouncementRepository.include });
    return rows.map(Mappers.announcement);
  }
}

export class PrismaPostRepository implements IPostRepository {
  private static readonly include = { community: true, author: true } as const;

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Post | null> {
    const row = await this.prisma.post.findUnique({ where: { id }, include: PrismaPostRepository.include });
    return row ? Mappers.post(row) : null;
  }

  async findByIds(ids: string[]): Promise<Post[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.post.findMany({
      where: { id: { in: ids } },
      include: PrismaPostRepository.include,
    });
    return rows.map(Mappers.post);
  }

  async findMany(query: ListQuery): Promise<{ items: Post[]; total: number }> {
    const { skip, take } = paginate(query);
    const search = query.search?.trim();

    const where: Record<string, unknown> = {};
    if (query.communityId) where.communityId = query.communityId;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { body: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: PrismaPostRepository.include,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items: rows.map(Mappers.post), total };
  }

  async create(data: PostInput): Promise<Post> {
    const row = await this.prisma.post.create({
      data: {
        communityId: data.communityId,
        authorId: data.authorId,
        title: data.title,
        body: data.body,
        summary: data.summary ?? '',
        tags: stringify(normalizeList(data.tags)),
      },
      include: PrismaPostRepository.include,
    });
    return Mappers.post(row);
  }

  async update(id: string, data: Partial<PostInput>): Promise<Post> {
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Post');
    const row = await this.prisma.post.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.tags !== undefined ? { tags: stringify(normalizeList(data.tags)) } : {}),
      },
      include: PrismaPostRepository.include,
    });
    return Mappers.post(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } });
  }

  async listAll(): Promise<Post[]> {
    const rows = await this.prisma.post.findMany({ include: PrismaPostRepository.include });
    return rows.map(Mappers.post);
  }
}

export class PrismaProjectRepository implements IProjectRepository {
  private static readonly include = { owner: true } as const;

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Project | null> {
    const row = await this.prisma.project.findUnique({ where: { id }, include: PrismaProjectRepository.include });
    return row ? Mappers.project(row) : null;
  }

  async findByIds(ids: string[]): Promise<Project[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.project.findMany({
      where: { id: { in: ids } },
      include: PrismaProjectRepository.include,
    });
    return rows.map(Mappers.project);
  }

  async findMany(query: ListQuery): Promise<{ items: Project[]; total: number }> {
    const { skip, take } = paginate(query);
    const search = query.search?.trim();

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { neededSkills: { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: PrismaProjectRepository.include,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items: rows.map(Mappers.project), total };
  }

  async create(data: ProjectInput): Promise<Project> {
    const row = await this.prisma.project.create({
      data: {
        ownerId: data.ownerId,
        title: data.title,
        description: data.description,
        neededSkills: stringify(normalizeList(data.neededSkills)),
        teamSize: data.teamSize ?? 4,
        status: data.status ?? 'OPEN',
      },
      include: PrismaProjectRepository.include,
    });
    return Mappers.project(row);
  }

  async update(id: string, data: Partial<ProjectInput>): Promise<Project> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Project');
    const row = await this.prisma.project.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.neededSkills !== undefined ? { neededSkills: stringify(normalizeList(data.neededSkills)) } : {}),
        ...(data.teamSize !== undefined ? { teamSize: data.teamSize } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: PrismaProjectRepository.include,
    });
    return Mappers.project(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  async listAll(): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({ include: PrismaProjectRepository.include });
    return rows.map(Mappers.project);
  }
}
