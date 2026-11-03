import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as {
  userPrisma?: PrismaClient;
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

const dbUrl = normalizePrismaUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.userPrisma ||
  new PrismaClient(
    dbUrl
      ? {
          datasources: {
            db: { url: dbUrl },
          },
        }
      : undefined,
  );

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.userPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
