import { PrismaClient } from "../generated/prisma";

const globalForPrisma = globalThis as unknown as {
  productPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.productPrisma ||
  new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.DATABASE_URL ||
          "postgresql://postgres:admin123@localhost:5432/larekmart_product_db",
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.productPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
