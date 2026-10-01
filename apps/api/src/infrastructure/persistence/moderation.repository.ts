import type { PrismaClient } from '@prisma/client';
import { stringify } from '../../core/json';
import { NotFoundError } from '../../core/errors';
import type { EmbeddingRecord, IndexableEntityType, Interaction, Report } from '../../domain/entities/models';
import type {
  EmbeddingUpsertInput,
  IAssistantQueryRepository,
  IEmbeddingRepository,
  IInteractionRepository,
  IReportRepository,
  ReportInput,
} from '../../domain/repositories';
import { Mappers } from './mappers';

export class PrismaReportRepository implements IReportRepository {
  private static readonly include = { reporter: true } as const;

  constructor(private readonly prisma: PrismaClient) {}

  async create(data: ReportInput): Promise<Report> {
    const row = await this.prisma.report.create({
      data: {
        targetType: data.targetType,
        targetId: data.targetId,
        targetTitle: data.targetTitle,
        reporterId: data.reporterId,
        reason: data.reason,
        details: data.details ?? '',
        status: data.status ?? 'PENDING',
        aiVerdict: data.aiVerdict ?? '',
        aiScore: data.aiScore ?? 0,
        aiRationale: data.aiRationale ?? '',
      },
      include: PrismaReportRepository.include,
    });
    return Mappers.report(row);
  }

  async findById(id: string): Promise<Report | null> {
    const row = await this.prisma.report.findUnique({ where: { id }, include: PrismaReportRepository.include });
    return row ? Mappers.report(row) : null;
  }

  async findMany(query: { status?: string; page?: number; pageSize?: number }): Promise<{ items: Report[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where = query.status ? { status: query.status } : {};

    const [rows, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: PrismaReportRepository.include,
        orderBy: [{ aiScore: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { items: rows.map(Mappers.report), total };
  }

  async updateStatus(id: string, data: { status: string; reviewerId: string; resolution?: string }): Promise<Report> {
    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Report');
    const row = await this.prisma.report.update({
      where: { id },
      data: { status: data.status, reviewerId: data.reviewerId, resolution: data.resolution ?? '' },
      include: PrismaReportRepository.include,
    });
    return Mappers.report(row);
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.prisma.report.groupBy({ by: ['status'], _count: { _all: true } });
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
  }
}

export class PrismaEmbeddingRepository implements IEmbeddingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertMany(records: EmbeddingUpsertInput[]): Promise<void> {
    for (const record of records) {
      const payload = {
        content: record.content,
        vector: stringify(record.vector),
        dimension: record.vector.length,
        model: record.model,
        metadata: stringify(record.metadata ?? {}),
      };
      await this.prisma.embeddingRecord.upsert({
        where: {
          entityType_entityId_chunkIndex: {
            entityType: record.entityType,
            entityId: record.entityId,
            chunkIndex: record.chunkIndex,
          },
        },
        create: {
          entityType: record.entityType,
          entityId: record.entityId,
          chunkIndex: record.chunkIndex,
          ...payload,
        },
        update: payload,
      });
    }
  }

  async deleteForEntity(entityType: IndexableEntityType, entityId: string): Promise<void> {
    await this.prisma.embeddingRecord.deleteMany({ where: { entityType, entityId } });
  }

  async findByTypes(types: IndexableEntityType[]): Promise<EmbeddingRecord[]> {
    const rows = await this.prisma.embeddingRecord.findMany({
      where: types.length > 0 ? { entityType: { in: types } } : undefined,
    });
    return rows.map(Mappers.embedding);
  }

  async findForEntity(entityType: IndexableEntityType, entityId: string): Promise<EmbeddingRecord[]> {
    const rows = await this.prisma.embeddingRecord.findMany({ where: { entityType, entityId } });
    return rows.map(Mappers.embedding);
  }

  count(): Promise<number> {
    return this.prisma.embeddingRecord.count();
  }
}

export class PrismaInteractionRepository implements IInteractionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(data: {
    userId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    weight?: number;
    context?: string;
  }): Promise<void> {
    await this.prisma.interaction.create({
      data: {
        userId: data.userId ?? null,
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        weight: data.weight ?? 1,
        context: data.context ?? '',
      },
    });
  }

  async listByUser(userId: string, limit = 50): Promise<Interaction[]> {
    const rows = await this.prisma.interaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(Mappers.interaction);
  }

  async listRecent(limit = 100): Promise<Interaction[]> {
    const rows = await this.prisma.interaction.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    return rows.map(Mappers.interaction);
  }

  async countsByEntity(entityType: string): Promise<Record<string, number>> {
    const rows = await this.prisma.interaction.groupBy({
      by: ['entityId'],
      where: { entityType },
      _count: { _all: true },
    });
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.entityId] = row._count._all;
      return acc;
    }, {});
  }

  async countsByAction(): Promise<Record<string, number>> {
    const rows = await this.prisma.interaction.groupBy({ by: ['action'], _count: { _all: true } });
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.action] = row._count._all;
      return acc;
    }, {});
  }

  async dailyCounts(days: number): Promise<{ date: string; count: number }[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.interaction.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      buckets.set(date, 0);
    }
    for (const row of rows) {
      const date = row.createdAt.toISOString().slice(0, 10);
      if (buckets.has(date)) buckets.set(date, (buckets.get(date) ?? 0) + 1);
    }
    return [...buckets.entries()].map(([date, count]) => ({ date, count }));
  }
}

export class PrismaAssistantQueryRepository implements IAssistantQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(data: {
    userId?: string | null;
    question: string;
    answer: string;
    sources: unknown[];
    topicLabel: string;
    latencyMs: number;
    provider: string;
  }): Promise<void> {
    await this.prisma.assistantQuery.create({
      data: {
        userId: data.userId ?? null,
        question: data.question,
        answer: data.answer,
        sources: stringify(data.sources),
        topicLabel: data.topicLabel,
        latencyMs: data.latencyMs,
        provider: data.provider,
      },
    });
  }

  async listRecent(limit = 25): Promise<{ question: string; topicLabel: string; createdAt: Date }[]> {
    const rows = await this.prisma.assistantQuery.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { question: true, topicLabel: true, createdAt: true },
    });
    return rows;
  }

  async topTopics(limit = 8): Promise<{ topic: string; count: number }[]> {
    const rows = await this.prisma.assistantQuery.groupBy({
      by: ['topicLabel'],
      _count: { _all: true },
    });
    return rows
      .filter((row) => row.topicLabel.trim().length > 0)
      .map((row) => ({ topic: row.topicLabel, count: row._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}
