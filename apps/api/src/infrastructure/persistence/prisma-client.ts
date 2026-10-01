import { PrismaClient } from '@prisma/client';
import { config } from '../../config/env';

/**
 * One PrismaClient per process. Exported through a factory so the composition
 * root owns the lifetime and tests can inject their own instance.
 */
let client: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!client) {
    client = new PrismaClient({
      log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return client;
};

export const disconnectPrisma = async (): Promise<void> => {
  if (client) {
    await client.$disconnect();
    client = null;
  }
};
