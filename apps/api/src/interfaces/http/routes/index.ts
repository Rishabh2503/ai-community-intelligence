import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { AppContainer } from '../../../container';
import { BadRequestError } from '../../../core/errors';
import { asyncHandler } from '../middleware';
import { createContentRouter, parseListQuery } from './content-router.factory';

const listSchema = z.array(z.string()).optional();

const profileSchema = z.object({
  headline: z.string().max(160).optional(),
  bio: z.string().max(4000).optional(),
  location: z.string().max(120).optional(),
  availability: z.enum(['OPEN', 'BUSY', 'HIRING', 'LOOKING_FOR_TEAM']).optional(),
  skills: listSchema,
  interests: listSchema,
  expertise: listSchema,
  links: z.record(z.string()).optional(),
  experienceYrs: z.number().int().min(0).max(60).optional(),
});

export const buildRouter = (container: AppContainer): Router => {
  const router = Router();
  const { auth } = container.middleware;

  router.get('/discovery/live', asyncHandler(async (req, res) => {
    const query = z.object({ region: z.string().trim().max(120).default(''), q: z.string().trim().max(160).default('') }).parse(req.query);
    res.json(await container.services.liveDiscovery.discover(query.region, query.q));
  }));

  // ---------------------------------------------------------------- health
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', aiProvider: container.ai.name, timestamp: new Date().toISOString() });
  });

  // ------------------------------------------------------------------ auth
  const authRouter = Router();
  authRouter.post(
    '/register',
    asyncHandler(async (req, res) => {
      const body = z
        .object({
          email: z.string().email(),
          password: z.string().min(6),
          name: z.string().min(2),
          role: z.enum(['MEMBER', 'ORGANIZER', 'ADMIN']).optional(),
          profile: profileSchema.optional(),
        })
        .parse(req.body);
      res.status(201).json(await container.services.auth.register(body));
    }),
  );

  authRouter.post(
    '/login',
    asyncHandler(async (req, res) => {
      const body = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
      res.json(await container.services.auth.login(body.email, body.password));
    }),
  );

  authRouter.get(
    '/me',
    auth.required,
    asyncHandler(async (req, res) => {
      res.json(await container.services.auth.me(req.user!.sub));
    }),
  );
  router.use('/auth', authRouter);

  // -------------------------------------------------------------- profiles
  const profileRouter = Router();
  profileRouter.get(
    '/',
    asyncHandler(async (req, res) => {
      const skills = typeof req.query.skills === 'string' ? req.query.skills.split(',').filter(Boolean) : undefined;
      res.json(
        await container.services.profiles.list({
          ...parseListQuery(req.query as Record<string, unknown>),
          skills,
          availability: typeof req.query.availability === 'string' ? req.query.availability : undefined,
        }),
      );
    }),
  );

  profileRouter.get(
    '/:userId',
    asyncHandler(async (req, res) => {
      res.json(await container.services.profiles.get(req.params.userId));
    }),
  );

  profileRouter.put(
    '/me',
    auth.required,
    asyncHandler(async (req, res) => {
      res.json(await container.services.profiles.upsert(req.user!.sub, profileSchema.parse(req.body)));
    }),
  );
  router.use('/profiles', profileRouter);

  // ----------------------------------------------------------- communities
  router.use(
    '/communities',
    createContentRouter({
      service: container.services.communities,
      auth,
      createSchema: z.object({
        name: z.string().min(2),
        description: z.string().min(10),
        category: z.string().min(2),
        tags: listSchema,
        location: z.string().optional(),
        isPublic: z.boolean().optional(),
      }),
      updateSchema: z
        .object({
          name: z.string().min(2).optional(),
          description: z.string().min(10).optional(),
          category: z.string().min(2).optional(),
          tags: listSchema,
          location: z.string().optional(),
          isPublic: z.boolean().optional(),
        })
        .strict(),
      extraRoutes: (communityRouter) => {
        communityRouter.get(
          '/mine',
          auth.required,
          asyncHandler(async (req, res) => {
            res.json(await container.services.communities.listForUser(req.user!.sub));
          }),
        );
        communityRouter.post(
          '/:id/join',
          auth.required,
          asyncHandler(async (req, res) => {
            await container.services.communities.join(req.params.id, req.user!.sub);
            res.status(201).json({ joined: true });
          }),
        );
        communityRouter.delete(
          '/:id/leave',
          auth.required,
          asyncHandler(async (req, res) => {
            await container.services.communities.leave(req.params.id, req.user!.sub);
            res.status(204).send();
          }),
        );
      },
    }),
  );

  // ---------------------------------------------------------------- events
  router.use(
    '/events',
    createContentRouter({
      service: container.services.events,
      auth,
      ownerField: 'organizerId',
      createSchema: z
        .object({
          communityId: z.string().min(1),
          title: z.string().min(3),
          description: z.string().min(10),
          mode: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
          venue: z.string().optional(),
          startsAt: z.coerce.date(),
          endsAt: z.coerce.date(),
          capacity: z.number().int().positive().optional(),
          tags: listSchema,
          bannerUrl: z.string().optional(),
          status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED']).optional(),
        })
        .refine((value) => value.endsAt >= value.startsAt, { message: 'endsAt must be after startsAt' }),
      updateSchema: z.object({
        title: z.string().min(3).optional(),
        description: z.string().min(10).optional(),
        mode: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
        venue: z.string().optional(),
        startsAt: z.coerce.date().optional(),
        endsAt: z.coerce.date().optional(),
        capacity: z.number().int().positive().optional(),
        tags: listSchema,
        bannerUrl: z.string().optional(),
        status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED']).optional(),
      }),
      extraRoutes: (eventRouter) => {
        eventRouter.get(
          '/upcoming',
          asyncHandler(async (req, res) => {
            res.json(await container.services.events.listUpcoming(Number(req.query.limit ?? 12)));
          }),
        );
        eventRouter.post(
          '/:id/rsvp',
          auth.required,
          asyncHandler(async (req, res) => {
            const body = z.object({ status: z.enum(['GOING', 'INTERESTED', 'CANCELLED']).default('GOING') }).parse(req.body ?? {});
            res.json(await container.services.events.rsvp(req.params.id, req.user!.sub, body.status));
          }),
        );
      },
    }),
  );

  // ------------------------------------------------------------- resources
  router.use(
    '/resources',
    createContentRouter({
      service: container.services.resources,
      auth,
      ownerField: 'authorId',
      createSchema: z.object({
        communityId: z.string().min(1),
        title: z.string().min(3),
        description: z.string().min(10),
        url: z.string().url().optional().or(z.literal('')),
        type: z.enum(['ARTICLE', 'VIDEO', 'REPO', 'COURSE', 'TOOL', 'DOC']).optional(),
        tags: listSchema,
      }),
      updateSchema: z.object({
        title: z.string().min(3).optional(),
        description: z.string().min(10).optional(),
        url: z.string().url().optional().or(z.literal('')),
        type: z.enum(['ARTICLE', 'VIDEO', 'REPO', 'COURSE', 'TOOL', 'DOC']).optional(),
        tags: listSchema,
      }),
    }),
  );

  // --------------------------------------------------------- announcements
  router.use(
    '/announcements',
    createContentRouter({
      service: container.services.announcements,
      auth,
      ownerField: 'authorId',
      createSchema: z.object({
        communityId: z.string().min(1),
        title: z.string().min(3),
        body: z.string().min(10),
        priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).optional(),
      }),
      updateSchema: z.object({
        title: z.string().min(3).optional(),
        body: z.string().min(10).optional(),
        priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).optional(),
      }),
    }),
  );

  // ----------------------------------------------------------------- posts
  router.use(
    '/posts',
    createContentRouter({
      service: container.services.posts,
      auth,
      ownerField: 'authorId',
      createSchema: z.object({
        communityId: z.string().min(1),
        title: z.string().min(3),
        body: z.string().min(10),
        tags: listSchema,
      }),
      updateSchema: z.object({
        title: z.string().min(3).optional(),
        body: z.string().min(10).optional(),
        tags: listSchema,
      }),
    }),
  );

  // -------------------------------------------------------------- projects
  router.use(
    '/projects',
    createContentRouter({
      service: container.services.projects,
      auth,
      ownerField: 'ownerId',
      createSchema: z.object({
        title: z.string().min(3),
        description: z.string().min(10),
        neededSkills: listSchema,
        teamSize: z.number().int().positive().max(50).optional(),
        status: z.enum(['OPEN', 'CLOSED']).optional(),
      }),
      updateSchema: z.object({
        title: z.string().min(3).optional(),
        description: z.string().min(10).optional(),
        neededSkills: listSchema,
        teamSize: z.number().int().positive().max(50).optional(),
        status: z.enum(['OPEN', 'CLOSED']).optional(),
      }),
    }),
  );

  router.use('/ai', buildAiRouter(container));
  router.use('/import', buildImportRouter(container));
  router.use('/moderation', buildModerationRouter(container));

  // ------------------------------------------------------------- analytics
  router.get(
    '/analytics/organizer',
    container.middleware.auth.required,
    container.middleware.auth.requireRole('ORGANIZER', 'ADMIN'),
    asyncHandler(async (_req, res) => {
      res.json(await container.services.analytics.organizerDashboard());
    }),
  );

  return router;
};

const buildAiRouter = (container: AppContainer): Router => {
  const router = Router();
  const { auth } = container.middleware;

  router.get(
    '/search',
    auth.optional,
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          q: z.string().min(1),
          types: z.string().optional(),
          limit: z.coerce.number().min(1).max(50).default(12),
        })
        .parse(req.query);

      res.json(
        await container.services.search.search(query.q, {
          types: query.types ? (query.types.split(',') as never) : undefined,
          limit: query.limit,
          userId: req.user?.sub ?? null,
        }),
      );
    }),
  );

  router.post(
    '/assistant',
    auth.optional,
    asyncHandler(async (req, res) => {
      const body = z.object({ question: z.string().min(3), topK: z.number().min(1).max(12).optional() }).parse(req.body);
      res.json(await container.services.assistant.ask(body.question, { userId: req.user?.sub ?? null, topK: body.topK }));
    }),
  );

  router.post(
    '/recommendations',
    auth.optional,
    asyncHandler(async (req, res) => {
      const body = z
        .object({
          intent: z.string().optional(),
          types: z.array(z.string()).optional(),
          limit: z.number().min(1).max(24).optional(),
        })
        .parse(req.body ?? {});

      res.json(
        await container.services.recommendations.recommend({
          userId: req.user?.sub ?? null,
          intent: body.intent,
          types: body.types as never,
          limit: body.limit,
        }),
      );
    }),
  );

  // ------------------------------------------------- Cognee (optional extra)
  router.get(
    '/banner/styles',
    asyncHandler(async (_req, res) => {
      res.json(container.services.banners.styles());
    }),
  );

  router.post(
    '/banner',
    auth.required,
    auth.requireRole('ORGANIZER', 'ADMIN'),
    asyncHandler(async (req, res) => {
      const body = z
        .object({
          description: z.string().min(3).max(400),
          style: z.string().optional(),
          seed: z.number().int().optional(),
        })
        .parse(req.body);
      res.json(container.services.banners.generate(body));
    }),
  );
  // Knowledge-graph memory as an opt-in second retrieval strategy. Isolated on
  // its own endpoints and always degrading to the built-in assistant, so the
  // core product is unaffected whether or not a Cognee key is present.

  router.get(
    '/cognee/status',
    asyncHandler(async (_req, res) => {
      res.json(container.services.cognee.status());
    }),
  );

  router.post(
    '/cognee/ingest',
    auth.required,
    auth.requireRole('ORGANIZER', 'ADMIN'),
    asyncHandler(async (_req, res) => {
      const documents = await container.services.indexing.exportCorpus();
      res.json(await container.services.cognee.ingest(documents));
    }),
  );

  router.post(
    '/cognee/ask',
    auth.optional,
    asyncHandler(async (req, res) => {
      const body = z
        .object({
          question: z.string().min(3),
          searchType: z.string().optional(),
        })
        .parse(req.body);

      try {
        const result = await container.services.cognee.search(body.question, body.searchType);
        res.json({ ...result, source: 'cognee', fellBack: false });
      } catch (error) {
        // Never fail the request: answer with the built-in assistant instead.
        const fallback = await container.services.assistant.ask(body.question, {
          userId: req.user?.sub ?? null,
        });
        res.json({
          answer: fallback.answer,
          searchType: body.searchType ?? 'GRAPH_COMPLETION',
          sources: fallback.sources,
          grounded: fallback.grounded,
          latencyMs: fallback.latencyMs,
          source: 'built-in',
          fellBack: true,
          reason: error instanceof Error ? error.message : 'Cognee unavailable',
        });
      }
    }),
  );

  router.post(
    '/match',
    auth.optional,
    asyncHandler(async (req, res) => {
      const body = z
        .object({
          projectId: z.string().optional(),
          requiredSkills: z.array(z.string()).optional(),
          description: z.string().optional(),
          limit: z.number().min(1).max(24).optional(),
        })
        .parse(req.body ?? {});

      if (body.projectId) {
        res.json(await container.services.matchmaking.matchForProject(body.projectId, body.limit));
        return;
      }
      res.json({
        project: null,
        candidates: await container.services.matchmaking.match({
          requiredSkills: body.requiredSkills,
          description: body.description,
          excludeUserIds: req.user ? [req.user.sub] : [],
          limit: body.limit,
        }),
      });
    }),
  );

  router.get(
    '/match/me',
    auth.required,
    asyncHandler(async (req, res) => {
      res.json({ candidates: await container.services.matchmaking.matchForUser(req.user!.sub) });
    }),
  );

  router.post(
    '/summarize',
    asyncHandler(async (req, res) => {
      const body = z
        .object({ text: z.string().min(20), style: z.enum(['brief', 'bullets']).optional() })
        .parse(req.body);
      res.json(await container.services.summarizer.summarize(body.text, { style: body.style }));
    }),
  );

  router.post(
    '/reindex',
    auth.required,
    container.middleware.auth.requireRole('ADMIN', 'ORGANIZER'),
    asyncHandler(async (_req, res) => {
      res.json(await container.services.indexing.reindexAll());
    }),
  );

  return router;
};

/**
 * Bulk ingestion: spreadsheet upload and live web-page scraping.
 * Both funnel into the normal content services, so imported material is
 * AI-summarised and indexed for semantic search like anything else.
 */
const buildImportRouter = (container: AppContainer): Router => {
  const router = Router();
  const { auth } = container.middleware;
  const publisherOnly = [auth.required, auth.requireRole('ORGANIZER', 'ADMIN')];
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  router.get(
    '/template',
    asyncHandler(async (_req, res) => {
      const buffer = await container.services.excelImport.buildTemplate();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="community-space-import-template.xlsx"');
      res.send(buffer);
    }),
  );

  router.post(
    '/excel',
    ...publisherOnly,
    upload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) throw new BadRequestError('Attach an .xlsx file in the "file" field');
      const communityId = typeof req.body?.communityId === 'string' ? req.body.communityId : undefined;
      res.json(await container.services.excelImport.import(req.file.buffer, { userId: req.user!.sub, communityId }));
    }),
  );

  router.post(
    '/url',
    ...publisherOnly,
    asyncHandler(async (req, res) => {
      const body = z.object({ url: z.string().min(4), communityId: z.string().optional() }).parse(req.body);
      res.json(
        await container.services.webIngest.ingest(body.url, { userId: req.user!.sub, communityId: body.communityId }),
      );
    }),
  );

  return router;
};

const buildModerationRouter = (container: AppContainer): Router => {  const router = Router();
  const { auth } = container.middleware;

  /** The report queue is admin-only. */
  const adminOnly = [auth.required, auth.requireRole('ADMIN')];
  /** Triage is a pre-publish quality check, so anyone who can publish may run it. */
  const publisherOnly = [auth.required, auth.requireRole('ORGANIZER', 'ADMIN')];

  router.post(
    '/triage',
    ...publisherOnly,
    asyncHandler(async (req, res) => {
      const body = z
        .object({
          entityType: z.enum(['EVENT', 'RESOURCE', 'ANNOUNCEMENT', 'POST', 'COMMUNITY', 'PROFILE', 'PROJECT']),
          entityId: z.string().optional(),
          title: z.string().min(1),
          body: z.string().default(''),
        })
        .parse(req.body);
      res.json(await container.services.moderation.triage(body));
    }),
  );

  router.post(
    '/reports',
    // Any signed-in member can report content - this is the community safety valve.
    auth.required,
    asyncHandler(async (req, res) => {
      const body = z
        .object({
          targetType: z.enum(['EVENT', 'RESOURCE', 'ANNOUNCEMENT', 'POST', 'COMMUNITY', 'PROFILE', 'PROJECT']),
          targetId: z.string().min(1),
          targetTitle: z.string().default(''),
          reason: z.enum(['SPAM', 'MISLEADING', 'DUPLICATE', 'INAPPROPRIATE', 'OTHER']),
          details: z.string().max(2000).optional(),
        })
        .parse(req.body);

      res.status(201).json(await container.services.moderation.report({ ...body, reporterId: req.user!.sub }));
    }),
  );

  router.get(
    '/reports',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      res.json(
        await container.services.moderation.list({
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
          page: req.query.page ? Number(req.query.page) : 1,
          pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
        }),
      );
    }),
  );

  router.patch(
    '/reports/:id',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const body = z
        .object({
          status: z.enum(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED']),
          resolution: z.string().max(1000).optional(),
        })
        .parse(req.body);
      res.json(await container.services.moderation.resolve(req.params.id, { ...body, reviewerId: req.user!.sub }));
    }),
  );

  router.get(
    '/stats',
    ...adminOnly,
    asyncHandler(async (_req, res) => {
      res.json(await container.services.moderation.stats());
    }),
  );

  return router;
};
