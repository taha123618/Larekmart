import { AsyncLocalStorage } from "node:async_hooks";
import {
  getCatalogDb,
  prisma,
  readPrisma,
  type PrismaClient,
} from "@repo/catalog-db";
import { parseLSN } from "@repo/redis";

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

/**
 * Pluggable source of the read-replica's current WAL replay position.
 * Defaults to `pg_last_wal_replay_lsn()` on the replica pool (typed as a
 * string such as "16/B374D848"); tests may substitute the method to
 * simulate replication lag deterministically without a live database.
 */
export interface ReplicaWalSource {
  /** Returns the replica replay LSN, or null when nothing has replayed yet. */
  getLsn(): Promise<string | null>;
}

export const replicaWal: ReplicaWalSource = {
  async getLsn(): Promise<string | null> {
    const rows = await readPrisma.$queryRaw<Array<{ lsn: string | null }>>
      `SELECT pg_last_wal_replay_lsn()::text AS lsn`;
    return rows[0]?.lsn ?? null;
  },
};

/**
 * Determines whether the read-replica is behind the caller's recorded
 * mutation position. A null or unparseable replica position means nothing
 * has been replayed yet — fail safe by reporting lag (route to primary).
 *
 * @param sessionLsn - The WAL LSN high-water mark cached for the session (may be null).
 * @param replicaLsn - The replica's current replay LSN (may be null).
 * @returns True when reads must be served from the primary.
 */
export function isReplicaLagging(
  sessionLsn: string | null,
  replicaLsn: string | null,
): boolean {
  if (!sessionLsn) return false;
  const sessionPosition = parseLSN(sessionLsn);
  if (sessionPosition === 0n) return false;
  const replicaPosition = parseLSN(replicaLsn ?? "");
  return replicaPosition === 0n || sessionPosition > replicaPosition;
}
