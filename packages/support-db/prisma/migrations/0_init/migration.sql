-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'WAITING_ON_AGENT', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."TicketSource" AS ENUM ('CUSTOMER', 'SELLER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."SenderRole" AS ENUM ('CUSTOMER', 'SELLER', 'AGENT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."SupportTeam" AS ENUM ('TIER_1', 'TIER_2', 'BILLING', 'SELLER_OPS', 'ESCALATIONS', 'LOGISTICS');

-- CreateTable
CREATE TABLE "public"."ticket_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "defaultPriority" "public"."TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "slaPolicyId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_sla_policies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "priority" "public"."TicketPriority" NOT NULL,
    "firstResponseTimeMinutes" INTEGER NOT NULL DEFAULT 240,
    "resolutionTimeMinutes" INTEGER NOT NULL DEFAULT 1440,
    "escalationTier" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ticket_sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tickets" (
    "id" UUID NOT NULL,
    "ticketNumber" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "public"."TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "categoryId" UUID NOT NULL,
    "slaPolicyId" UUID,
    "source" "public"."TicketSource" NOT NULL DEFAULT 'CUSTOMER',
    "customerId" VARCHAR(128),
    "customerEmail" VARCHAR(255),
    "customerPhone" VARCHAR(64),
    "sellerId" VARCHAR(128),
    "orderId" VARCHAR(128),
    "paymentId" VARCHAR(128),
    "returnId" VARCHAR(128),
    "assignedAgentId" VARCHAR(128),
    "assignedTeam" "public"."SupportTeam" DEFAULT 'TIER_1',
    "firstResponseDueAt" TIMESTAMPTZ(6),
    "resolutionDueAt" TIMESTAMPTZ(6),
    "firstResponseAt" TIMESTAMPTZ(6),
    "resolvedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "isEscalated" BOOLEAN NOT NULL DEFAULT false,
    "escalatedAt" TIMESTAMPTZ(6),
    "escalationReason" TEXT,
    "chatSessionId" VARCHAR(128),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_messages" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "senderId" VARCHAR(128) NOT NULL,
    "senderRole" "public"."SenderRole" NOT NULL DEFAULT 'CUSTOMER',
    "senderName" VARCHAR(128),
    "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "mediaAttachments" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_assignments" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "assignedBy" VARCHAR(128) NOT NULL,
    "assignedTo" VARCHAR(128) NOT NULL,
    "assignedTeam" "public"."SupportTeam" DEFAULT 'TIER_1',
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,

    CONSTRAINT "ticket_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_history" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "actorId" VARCHAR(128) NOT NULL,
    "actorRole" "public"."SenderRole" NOT NULL DEFAULT 'SYSTEM',
    "action" VARCHAR(64) NOT NULL,
    "fromState" JSONB,
    "toState" JSONB,
    "changeReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_categories_code_key" ON "public"."ticket_categories"("code");

-- CreateIndex
CREATE INDEX "ticket_categories_isActive_idx" ON "public"."ticket_categories"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_sla_policies_priority_key" ON "public"."ticket_sla_policies"("priority");

-- CreateIndex
CREATE INDEX "ticket_sla_policies_isActive_idx" ON "public"."ticket_sla_policies"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticketNumber_key" ON "public"."tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "public"."tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_priority_idx" ON "public"."tickets"("priority");

-- CreateIndex
CREATE INDEX "tickets_customerId_idx" ON "public"."tickets"("customerId");

-- CreateIndex
CREATE INDEX "tickets_sellerId_idx" ON "public"."tickets"("sellerId");

-- CreateIndex
CREATE INDEX "tickets_orderId_idx" ON "public"."tickets"("orderId");

-- CreateIndex
CREATE INDEX "tickets_assignedAgentId_idx" ON "public"."tickets"("assignedAgentId");

-- CreateIndex
CREATE INDEX "tickets_assignedTeam_idx" ON "public"."tickets"("assignedTeam");

-- CreateIndex
CREATE INDEX "tickets_createdAt_idx" ON "public"."tickets"("createdAt");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_idx" ON "public"."ticket_messages"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_messages_senderId_idx" ON "public"."ticket_messages"("senderId");

-- CreateIndex
CREATE INDEX "ticket_messages_isInternalNote_idx" ON "public"."ticket_messages"("isInternalNote");

-- CreateIndex
CREATE INDEX "ticket_messages_createdAt_idx" ON "public"."ticket_messages"("createdAt");

-- CreateIndex
CREATE INDEX "ticket_assignments_ticketId_idx" ON "public"."ticket_assignments"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_assignments_assignedTo_idx" ON "public"."ticket_assignments"("assignedTo");

-- CreateIndex
CREATE INDEX "ticket_assignments_assignedTeam_idx" ON "public"."ticket_assignments"("assignedTeam");

-- CreateIndex
CREATE INDEX "ticket_assignments_status_idx" ON "public"."ticket_assignments"("status");

-- CreateIndex
CREATE INDEX "ticket_history_ticketId_idx" ON "public"."ticket_history"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_history_actorId_idx" ON "public"."ticket_history"("actorId");

-- CreateIndex
CREATE INDEX "ticket_history_action_idx" ON "public"."ticket_history"("action");

-- CreateIndex
CREATE INDEX "ticket_history_createdAt_idx" ON "public"."ticket_history"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."ticket_categories" ADD CONSTRAINT "ticket_categories_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "public"."ticket_sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."ticket_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "public"."ticket_sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_history" ADD CONSTRAINT "ticket_history_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

