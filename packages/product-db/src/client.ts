import { PrismaClient } from "../generated/prisma";

const globalForPrisma = globalThis as unknown as {
  productPrisma?: PrismaClient;
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
