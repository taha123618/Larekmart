import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as {
  catalogPrisma?: PrismaClient;
  catalogReadPrisma?: PrismaClient;
};

const writeUrl = process.env.DATABASE_URL;
const readUrl =
  process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_URL;

/**
 * Primary read-write Prisma client.
 * Used by Kafka event projectors and mutation paths.
 */
export const prisma =
  globalForPrisma.catalogPrisma ||
  new PrismaClient(
    writeUrl
      ? {
          datasources: {
            db: { url: writeUrl },
          },
        }
      : undefined,
  );

/**
 * Read-replica Prisma client.
 * Routes discovery queries and storefront customer traffic to dedicated
 * PostgreSQL read replicas (or PgBouncer read pools), offloading primary writer nodes.
 * Transparently falls back to `prisma` if `DATABASE_READ_REPLICA_URL` is omitted.
 */
export const readPrisma =
  globalForPrisma.catalogReadPrisma ||
  (readUrl && readUrl !== writeUrl
    ? new PrismaClient({
        datasources: {
          db: { url: readUrl },
        },
      })
    : prisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.catalogPrisma = prisma;
  globalForPrisma.catalogReadPrisma = readPrisma;
}

export async function disconnectPrisma(): Promise<void> {
  const disconnects = [prisma.$disconnect()];
  if (readPrisma !== prisma) {
    disconnects.push(readPrisma.$disconnect());
  }
  await Promise.all(disconnects);
}

/**
 * Resolves the appropriate Prisma client based on consistency requirements.
 * When `forcePrimary` is true (e.g. active Read-Your-Writes consistency lease),
 * returns `prisma` (primary master writer). Otherwise returns `readPrisma`
 * (read replica pool via PgBouncer).
 */
export function getCatalogDb(forcePrimary?: boolean): PrismaClient {
  if (forcePrimary) {
    return prisma;
  }
  return readPrisma;
}
