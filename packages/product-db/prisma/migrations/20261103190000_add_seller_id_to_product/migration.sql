-- AlterTable
ALTER TABLE "Product" ADD COLUMN "sellerId" TEXT;

-- CreateIndex
CREATE INDEX "Product_sellerId_idx" ON "Product"("sellerId");

