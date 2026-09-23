-- CreateEnum
CREATE TYPE "WarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('ACTIVE', 'LOW_STOCK', 'OUT_OF_STOCK', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE', 'RESTOCK', 'RESERVE', 'RELEASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('RESERVED', 'CONFIRMED', 'RELEASED', 'EXPIRED');

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- Seed initial default warehouses for dev and test consistency
INSERT INTO "warehouses" ("id", "name", "code", "status", "address", "createdAt", "updatedAt")
VALUES
    ('main-warehouse', 'Main Fulfillment Center', 'MAIN-WH', 'ACTIVE', 'Karachi Hub, Logistics Avenue', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('wh-integration-test', 'Test Integration Warehouse', 'TEST-WH', 'ACTIVE', 'QA Test Facility', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Enforce the stock accounting invariant at the source of truth.
ALTER TABLE "inventory_items"
    ADD CONSTRAINT "inventory_items_nonnegative_quantities_check"
    CHECK ("quantity" >= 0 AND "reservedQuantity" >= 0 AND "soldQuantity" >= 0 AND "availableQuantity" >= 0 AND "reorderPoint" >= 0),
    ADD CONSTRAINT "inventory_items_quantity_breakdown_check"
    CHECK ("quantity" = "availableQuantity" + "reservedQuantity" + "soldQuantity");

ALTER TABLE "inventory_reservations"
    ADD CONSTRAINT "inventory_reservations_quantity_positive_check"
    CHECK ("quantity" > 0);

ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_quantity_positive_check"
    CHECK ("quantity" > 0);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");
CREATE INDEX "warehouses_status_idx" ON "warehouses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_productId_variantId_warehouseId_key" ON "inventory_items"("productId", "variantId", "warehouseId");
CREATE INDEX "inventory_items_productId_idx" ON "inventory_items"("productId");
CREATE INDEX "inventory_items_warehouseId_idx" ON "inventory_items"("warehouseId");
CREATE INDEX "inventory_items_status_idx" ON "inventory_items"("status");

-- CreateIndex
CREATE INDEX "inventory_reservations_inventoryItemId_status_idx" ON "inventory_reservations"("inventoryItemId", "status");
CREATE INDEX "inventory_reservations_userId_status_idx" ON "inventory_reservations"("userId", "status");
CREATE INDEX "inventory_reservations_expiresAt_status_idx" ON "inventory_reservations"("expiresAt", "status");
CREATE UNIQUE INDEX "inventory_reservations_referenceType_referenceId_inventoryI_key" ON "inventory_reservations"("referenceType", "referenceId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_movements_inventoryItemId_createdAt_idx" ON "inventory_movements"("inventoryItemId", "createdAt");
CREATE INDEX "inventory_movements_type_createdAt_idx" ON "inventory_movements"("type", "createdAt");
CREATE INDEX "inventory_movements_referenceType_referenceId_idx" ON "inventory_movements"("referenceType", "referenceId");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

