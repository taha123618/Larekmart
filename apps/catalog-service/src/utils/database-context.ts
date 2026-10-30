import { AsyncLocalStorage } from "node:async_hooks";
import {
  getCatalogDb,
  prisma,
  readPrisma,
  type PrismaClient,
} from "@repo/catalog-db";

export interface DatabaseContext {
  forcePrimary: boolean;
  clientId?: string;
}

export const databaseContext = new AsyncLocalStorage<DatabaseContext>();

/**
 * Resolves the active Prisma database client for the current execution tick.
 * If explicitForcePrimary is defined, honors it directly.
 * Otherwise inspects the ambient DatabaseContext (from Fastify request).
 *
 * - When forcePrimary is true (active Read-Your-Writes lease or explicit override):
 *   Returns `prisma` (primary master writer pool).
 * - Otherwise:
 *   Returns `readPrisma` (read replica pool via PgBouncer).
 */
export function getDatabaseClient(
  explicitForcePrimary?: boolean,
): PrismaClient {
  if (explicitForcePrimary !== undefined) {
    return getCatalogDb(explicitForcePrimary);
  }
  const store = databaseContext.getStore();
  if (store?.forcePrimary) {
    return prisma;
  }
  return readPrisma;
}
