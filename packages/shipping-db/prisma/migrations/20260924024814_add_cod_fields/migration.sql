-- AlterTable
ALTER TABLE "public"."Shipment" ADD COLUMN     "codAmount" INTEGER,
ADD COLUMN     "codFee" INTEGER DEFAULT 0,
ADD COLUMN     "codStatus" TEXT,
ADD COLUMN     "isCod" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Shipment_isCod_codStatus_idx" ON "public"."Shipment"("isCod", "codStatus");
