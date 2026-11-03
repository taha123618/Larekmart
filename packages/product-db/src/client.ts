import { PrismaClient } from "../generated/prisma";

const globalForPrisma = globalThis as unknown as {
  productPrisma?: PrismaClient;
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
  "postgresql://postgres:admin123@localhost:5432/larekmart_product_db";
const dbUrl = normalizePrismaUrl(rawUrl);

export const prisma =
  globalForPrisma.productPrisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.productPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
