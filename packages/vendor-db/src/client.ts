import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as {
  vendorPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.vendorPrisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.vendorPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
