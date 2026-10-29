import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as {
  userPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.userPrisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.userPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
