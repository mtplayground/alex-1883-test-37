import { prisma } from './prisma.js';

type DatabaseHealthRow = {
  connected: boolean;
};

export async function checkDatabaseConnection(): Promise<DatabaseHealthRow> {
  await prisma.$queryRaw`SELECT 1`;

  return { connected: true };
}
