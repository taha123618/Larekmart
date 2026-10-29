import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as {
  catalogPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.catalogPrisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.catalogPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
