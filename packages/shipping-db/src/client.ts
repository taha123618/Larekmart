import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as {
  shippingPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.shippingPrisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.shippingPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
