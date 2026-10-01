import { Router } from 'express';
import { z } from 'zod';
import type { ListQuery } from '../../../domain/repositories';
import type { IndexedContentService } from '../../../application/services/indexed-content.service';
import { asyncHandler } from '../middleware';
import type { createAuthMiddleware } from '../middleware';

/**
 * Generic CRUD router factory.
 *
 * Resources, announcements, posts and projects expose the same five endpoints;
 * building them from one factory keeps the HTTP layer free of copy-paste and
 * guarantees consistent status codes and pagination (DRY).
 * Anything entity-specific is injected as `extraRoutes`.
 */
export interface ContentRouterOptions<TService> {
  service: TService;
  auth: ReturnType<typeof createAuthMiddleware>;
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  /** Injects the authenticated user id into the create payload. */
  ownerField?: string;
  extraRoutes?: (router: Router) => void;
}

export const parseListQuery = (query: Record<string, unknown>): ListQuery & Record<string, unknown> => ({
  search: typeof query.q === 'string' ? query.q : undefined,
  communityId: typeof query.communityId === 'string' ? query.communityId : undefined,
  location: typeof query.location === 'string' ? query.location : undefined,
  type: typeof query.type === 'string' ? query.type : undefined,
  mode: typeof query.mode === 'string' ? query.mode : undefined,
  upcomingOnly: query.upcoming === 'true',
  page: query.page ? Number(query.page) : 1,
  pageSize: query.pageSize ? Number(query.pageSize) : 20,
});

export const createContentRouter = <TService extends IndexedContentService<any, any, any>>(
  options: ContentRouterOptions<TService>,
): Router => {
  const router = Router();
  const { service, auth, createSchema, updateSchema, ownerField } = options;

  options.extraRoutes?.(router);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await service.list(parseListQuery(req.query as Record<string, unknown>)));
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const item = await service.getById(req.params.id);
      if (!item) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
        return;
      }
      res.json(item);
    }),
  );

  router.post(
    '/',
    auth.required,
    asyncHandler(async (req, res) => {
      const payload = createSchema.parse(req.body);
      const withOwner = ownerField ? { ...payload, [ownerField]: req.user!.sub } : payload;
      res.status(201).json(await service.create(withOwner));
    }),
  );

  router.patch(
    '/:id',
    auth.required,
    asyncHandler(async (req, res) => {
      res.json(await service.update(req.params.id, updateSchema.parse(req.body)));
    }),
  );

  router.delete(
    '/:id',
    auth.required,
    asyncHandler(async (req, res) => {
      await service.delete(req.params.id);
      res.status(204).send();
    }),
  );

  return router;
};
