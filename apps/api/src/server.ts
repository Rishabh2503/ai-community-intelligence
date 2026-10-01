import { config } from './config/env';
import { createLogger } from './core/logger';
import { createApp } from './app';
import { createContainer } from './container';
import { disconnectPrisma } from './infrastructure/persistence/prisma-client';

const logger = createLogger('Server');

const bootstrap = async (): Promise<void> => {
  const container = createContainer();
  const app = createApp(container);

  const server = app.listen(config.PORT, () => {
    logger.info(`Community Space API listening on http://localhost:${config.PORT}/api`);
    logger.info(`AI provider: ${container.ai.name}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down...`);
    server.close();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

bootstrap().catch((error) => {
  logger.error('Failed to start server', { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
