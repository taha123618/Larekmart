import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as {
  vendorPrisma?: PrismaClient;
};

export function normalizePrismaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.includes(":6432") && !url.includes("pgbouncer=true")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}pgbouncer=true`;
  }
  return url;
}

const dbUrl = normalizePrismaUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.vendorPrisma ||
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
  globalForPrisma.vendorPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
