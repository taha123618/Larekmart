-- CreateEnum
CREATE TYPE "public"."ShipmentStatus" AS ENUM ('PENDING', 'LABEL_CREATED', 'READY_TO_SHIP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED', 'LOST');

-- CreateTable
CREATE TABLE "public"."Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "carrier" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'standard',
    "trackingNumber" TEXT,
    "status" "public"."ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "shippingAddress" JSONB NOT NULL,
    "shippingRateAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "estimatedDeliveryAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShipmentItem" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION,
    "sku" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShipmentPackage" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "packageType" TEXT NOT NULL DEFAULT 'box',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShippingMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "baseRate" INTEGER NOT NULL DEFAULT 0,
    "estimatedDaysMin" INTEGER NOT NULL DEFAULT 1,
    "estimatedDaysMax" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrackingEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "public"."ShipmentStatus" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShippingLabel" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "labelUrl" TEXT NOT NULL,
    "cost" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryAttempt" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'failed',
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShippingWebhook" (
    "id" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "externalEventId" TEXT,
    "signature" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CarrierAccount" (
    "id" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "accountNumber" TEXT,
    "apiKeyEncrypted" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTestMode" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_trackingNumber_key" ON "public"."Shipment"("trackingNumber");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "public"."Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_userId_idx" ON "public"."Shipment"("userId");

-- CreateIndex
CREATE INDEX "Shipment_carrier_status_idx" ON "public"."Shipment"("carrier", "status");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "public"."Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_createdAt_idx" ON "public"."Shipment"("createdAt");

-- CreateIndex
CREATE INDEX "ShipmentItem_shipmentId_idx" ON "public"."ShipmentItem"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentPackage_shipmentId_idx" ON "public"."ShipmentPackage"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingMethod_code_key" ON "public"."ShippingMethod"("code");

-- CreateIndex
CREATE INDEX "ShippingMethod_carrier_isActive_idx" ON "public"."ShippingMethod"("carrier", "isActive");

-- CreateIndex
CREATE INDEX "TrackingEvent_shipmentId_occurredAt_idx" ON "public"."TrackingEvent"("shipmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "ShippingLabel_shipmentId_idx" ON "public"."ShippingLabel"("shipmentId");

-- CreateIndex
CREATE INDEX "ShippingLabel_trackingNumber_idx" ON "public"."ShippingLabel"("trackingNumber");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_shipmentId_idx" ON "public"."DeliveryAttempt"("shipmentId");

-- CreateIndex
CREATE INDEX "ShippingWebhook_carrier_externalEventId_idx" ON "public"."ShippingWebhook"("carrier", "externalEventId");

-- CreateIndex
CREATE INDEX "ShippingWebhook_status_idx" ON "public"."ShippingWebhook"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventId_key" ON "public"."ProcessedEvent"("eventId");

-- CreateIndex
CREATE INDEX "ProcessedEvent_eventType_idx" ON "public"."ProcessedEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierAccount_carrier_key" ON "public"."CarrierAccount"("carrier");

-- AddForeignKey
ALTER TABLE "public"."ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShipmentPackage" ADD CONSTRAINT "ShipmentPackage_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrackingEvent" ADD CONSTRAINT "TrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShippingLabel" ADD CONSTRAINT "ShippingLabel_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
