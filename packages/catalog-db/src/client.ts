import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as {
  catalogPrisma?: PrismaClient;
  catalogReadPrisma?: PrismaClient;
};

export function normalizePrismaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  let normalized = url;
  if (normalized.includes(":6432") && !normalized.includes("pgbouncer=true")) {
    const sep = normalized.includes("?") ? "&" : "?";
    normalized = `${normalized}${sep}pgbouncer=true`;
  }
  if (
    (normalized.includes(":6432") || normalized.includes("pgbouncer=true")) &&
    !normalized.includes("statement_cache_size=0")
  ) {
    const sep = normalized.includes("?") ? "&" : "?";
    normalized = `${normalized}${sep}statement_cache_size=0`;
  }
  return normalized;
}

const writeUrl = normalizePrismaUrl(process.env.DATABASE_URL);
const readUrl = normalizePrismaUrl(
  process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_URL,
);

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

function isConnectionError(err: any): boolean {
  return Boolean(
    err?.name === "PrismaClientInitializationError" ||
      err?.code === "P1001" ||
      err?.code === "P1002" ||
      err?.code === "P1003" ||
      err?.code === "P1017" ||
      (typeof err?.message === "string" &&
        (err.message.includes("Can't reach database server") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("Server has closed the connection"))),
  );
}

/**
 * Wraps the read-replica client with transparent failover to the primary writer.
 * If the read-replica or PgBouncer becomes unreachable (P1001, connection refused),
 * discovery queries automatically fall back to the primary database rather than
 * dropping customer traffic or returning 500 errors.
 */
function createResilientReadClient(
  primaryClient: PrismaClient,
  replicaClient: PrismaClient,
): PrismaClient {
  if (primaryClient === replicaClient) return primaryClient;

  let replicaHealthy = true;
  let lastHealthCheck = 0;
  const HEALTH_CHECK_INTERVAL_MS = 30_000;

  const handler: ProxyHandler<PrismaClient> = {
    get(target, prop, receiver) {
      const now = Date.now();
      if (!replicaHealthy && now - lastHealthCheck > HEALTH_CHECK_INTERVAL_MS) {
        replicaHealthy = true;
      }

      if (prop === "$queryRaw" || prop === "$queryRawUnsafe") {
        const origQuery = (target as any)[prop];
        return async (...args: any[]) => {
          if (!replicaHealthy) {
            return (primaryClient as any)[prop](...args);
          }
          try {
            return await origQuery.apply(target, args);
          } catch (err: any) {
            if (isConnectionError(err)) {
              replicaHealthy = false;
              lastHealthCheck = Date.now();
              return (primaryClient as any)[prop](...args);
            }
            throw err;
          }
        };
      }

      const value = Reflect.get(target, prop, receiver);

      if (
        typeof prop === "string" &&
        !prop.startsWith("$") &&
        value !== null &&
        typeof value === "object"
      ) {
        return new Proxy(value, {
          get(modelTarget, methodProp) {
            const origMethod = modelTarget[methodProp];
            if (typeof origMethod !== "function") return origMethod;

            return async (...args: any[]) => {
              if (!replicaHealthy) {
                const primaryDelegate = (primaryClient as any)[prop];
                if (
                  primaryDelegate &&
                  typeof primaryDelegate[methodProp] === "function"
                ) {
                  return primaryDelegate[methodProp](...args);
                }
              }

              try {
                return await origMethod.apply(modelTarget, args);
              } catch (err: any) {
                if (isConnectionError(err)) {
                  replicaHealthy = false;
                  lastHealthCheck = Date.now();
                  const primaryDelegate = (primaryClient as any)[prop];
                  if (
                    primaryDelegate &&
                    typeof primaryDelegate[methodProp] === "function"
                  ) {
                    return primaryDelegate[methodProp](...args);
                  }
                }
                throw err;
              }
            };
          },
        });
      }

      return value;
    },
  };

  return new Proxy(replicaClient, handler);
}

const rawReadPrisma =
  readUrl && readUrl !== writeUrl
    ? new PrismaClient({
        datasources: {
          db: { url: readUrl },
        },
      })
    : prisma;

/**
 * Read-replica Prisma client.
 * Routes discovery queries and storefront customer traffic to dedicated
 * PostgreSQL read replicas (or PgBouncer read pools), offloading primary writer nodes.
 * Transparently falls back to `prisma` if `DATABASE_READ_REPLICA_URL` is omitted or unreachable.
 */
export const readPrisma =
  globalForPrisma.catalogReadPrisma ||
  createResilientReadClient(prisma, rawReadPrisma);

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
