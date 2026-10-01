import type { PrismaClient } from '@prisma/client';
import { stringify, normalizeList } from '../../core/json';
import type { Profile, UserRole } from '../../domain/entities/models';
import type {
  IProfileRepository,
  IUserRepository,
  ListQuery,
  ProfileInput,
  UserRecord,
} from '../../domain/repositories';
import { Mappers } from './mappers';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return row ? { ...row, role: row.role as UserRole } : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? { ...row, role: row.role as UserRole } : null;
  }

  async create(data: { email: string; name: string; passwordHash: string; role: UserRole }): Promise<UserRecord> {
    const row = await this.prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() },
    });
    return { ...row, role: row.role as UserRole };
  }

  count(): Promise<number> {
    return this.prisma.user.count();
  }
}

export class PrismaProfileRepository implements IProfileRepository {
  private static readonly include = { user: true } as const;

  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    const row = await this.prisma.profile.findUnique({
      where: { userId },
      include: PrismaProfileRepository.include,
    });
    return row ? Mappers.profile(row) : null;
  }

  async findByIds(userIds: string[]): Promise<Profile[]> {
    if (userIds.length === 0) return [];
    const rows = await this.prisma.profile.findMany({
      where: { userId: { in: userIds } },
      include: PrismaProfileRepository.include,
    });
    return rows.map(Mappers.profile);
  }

  async findMany(
    query: ListQuery & { skills?: string[]; availability?: string },
  ): Promise<{ items: Profile[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const search = query.search?.trim();

    // SQLite cannot filter inside a JSON string reliably, so text filtering is
    // done over the indexed columns and skill filtering happens in memory.
    const where: Record<string, unknown> = {};
    if (query.availability) where.availability = query.availability;
    if (search) {
      where.OR = [
        { headline: { contains: search } },
        { bio: { contains: search } },
        { skills: { contains: search } },
        { expertise: { contains: search } },
        { interests: { contains: search } },
        { user: { is: { name: { contains: search } } } },
      ];
    }

    const rows = await this.prisma.profile.findMany({
      where,
      include: PrismaProfileRepository.include,
      orderBy: { updatedAt: 'desc' },
    });

    let mapped = rows.map(Mappers.profile);
    const requiredSkills = normalizeList(query.skills).map((s) => s.toLowerCase());
    if (requiredSkills.length > 0) {
      mapped = mapped.filter((profile) => {
        const owned = [...profile.skills, ...profile.expertise].map((s) => s.toLowerCase());
        return requiredSkills.some((skill) => owned.some((item) => item.includes(skill)));
      });
    }

    return {
      total: mapped.length,
      items: mapped.slice((page - 1) * pageSize, page * pageSize),
    };
  }

  async upsert(userId: string, data: ProfileInput): Promise<Profile> {
    const payload = {
      headline: data.headline ?? '',
      bio: data.bio ?? '',
      location: data.location ?? '',
      availability: data.availability ?? 'OPEN',
      skills: stringify(normalizeList(data.skills)),
      interests: stringify(normalizeList(data.interests)),
      expertise: stringify(normalizeList(data.expertise)),
      links: stringify(data.links ?? {}),
      experienceYrs: data.experienceYrs ?? 0,
    };

    const row = await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...payload },
      update: payload,
      include: PrismaProfileRepository.include,
    });
    return Mappers.profile(row);
  }

  async listAll(): Promise<Profile[]> {
    const rows = await this.prisma.profile.findMany({ include: PrismaProfileRepository.include });
    return rows.map(Mappers.profile);
  }
}
