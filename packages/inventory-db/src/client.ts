import { PrismaClient } from "../generated/prisma";

const globalForPrisma = globalThis as unknown as {
  inventoryPrisma?: PrismaClient;
};

export function normalizePrismaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.includes(":6432") && !url.includes("pgbouncer=true")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}pgbouncer=true`;
  }
  return url;
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
