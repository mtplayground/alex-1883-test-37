import { PrismaClient } from '@prisma/client';
import { getAppConfig } from '../config/env.js';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      getAppConfig().nodeEnv === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (getAppConfig().nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}
