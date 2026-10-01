import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';
import type { AppContainer } from './container';
import { errorHandler, notFoundHandler } from './interfaces/http/middleware';
import { buildRouter } from './interfaces/http/routes';

/**
 * Builds the Express application from an already-wired container.
 * Keeping this separate from `server.ts` makes the app testable with
 * supertest without opening a port.
 */
export const createApp = (container: AppContainer): Express => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN.split(',').map((origin) => origin.trim()) }));
  app.use(express.json({ limit: '1mb' }));
  if (config.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.use('/api', buildRouter(container));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
