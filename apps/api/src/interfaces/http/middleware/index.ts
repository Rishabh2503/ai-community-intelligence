import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, UnauthorizedError, ForbiddenError } from '../../../core/errors';
import { createLogger } from '../../../core/logger';
import type { ITokenService, TokenPayload } from '../../../infrastructure/security/security';

const logger = createLogger('HTTP');

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Wraps async handlers so a rejected promise reaches the error middleware.
 * Written once here instead of a try/catch in every controller (DRY).
 */
export const asyncHandler =
  <T>(handler: (req: Request, res: Response, next: NextFunction) => Promise<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };

export const createAuthMiddleware = (tokens: ITokenService) => ({
  /** Rejects the request when no valid bearer token is present. */
  required(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next(new UnauthorizedError());
    try {
      req.user = tokens.verify(header.slice(7));
      next();
    } catch (error) {
      next(error);
    }
  },

  /** Attaches the user when a token exists, but never blocks the request. */
  optional(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        req.user = tokens.verify(header.slice(7));
      } catch {
        // An invalid token on a public endpoint is simply ignored.
      }
    }
    next();
  },

  /** Role gate for organizer/admin-only routes. */
  requireRole(...roles: string[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
      if (!req.user) return next(new UnauthorizedError());
      if (!roles.includes(req.user.role)) return next(new ForbiddenError(`Requires role: ${roles.join(' or ')}`));
      next();
    };
  },
});

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
};

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.flatten() },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }

  const message = error instanceof Error ? error.message : 'Unexpected error';
  logger.error('Unhandled error', { message });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } });
};
