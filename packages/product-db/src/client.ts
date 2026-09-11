import { PrismaClient } from "../generated/prisma";
import { createLogger } from "@repo/monitoring";

const logger = createLogger("product-db");
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
} else {
  logger.info("Prisma Client initialized for production PostgreSQL database");
}
