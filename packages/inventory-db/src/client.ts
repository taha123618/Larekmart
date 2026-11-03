import { PrismaClient } from "../generated/prisma";

const globalForPrisma = globalThis as unknown as {
  inventoryPrisma?: PrismaClient;
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

const rawUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:admin123@localhost:5432/larekmart_inventory_db?schema=public";
const dbUrl = normalizePrismaUrl(rawUrl);

export const prisma =
  globalForPrisma.inventoryPrisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.inventoryPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
