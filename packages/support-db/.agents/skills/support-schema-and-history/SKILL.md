---
name: support-schema-and-history
description: Use when authoring, modifying, testing, or debugging Prisma schemas, PostgreSQL migrations, ticket models, immutable history audit trails, or database transactions in packages/support-db.
---

# Support Database Schema & History Playbook — @repo/support-db

This playbook governs database schemas, Prisma migrations, and query patterns in `packages/support-db`.

## 1. Schema Invariants & Design

- **Database:** PostgreSQL (`larekmart_support_db`).
- **Schema File:** `prisma/schema.prisma`.
- **Generated Client:** Output to `generated/prisma/`. Never edit generated files directly.
- **Models:**
  - `Ticket`: Core entity with unique `ticketNumber` (`TKT-YYYY-XXXXX`), status enum, priority enum, customer/seller/order/return references, SLA deadlines, and metadata.
  - `TicketMessage`: Message timeline with sender role (`CUSTOMER`, `SELLER`, `AGENT`, `ADMIN`, `SYSTEM`), `isInternalNote` boolean, and JSON media attachments.
  - `TicketAssignment`: Append-only assignment logs recording agent ID, support team, assigner, and notes.
  - `TicketCategory`: Dynamic categorization codes with default priority and SLA policy mapping.
  - `TicketSlaPolicy`: Configured target response and resolution durations.
  - `TicketHistory`: Immutable audit trail recording every state change, actor role, before/after states, and reasons.

## 2. Migration & Generation Workflow

```bash
# Generate Prisma Client
pnpm --filter @repo/support-db db:generate

# Create or apply PostgreSQL migrations
pnpm --filter @repo/support-db db:migrate

# Type-check
pnpm --filter @repo/support-db check-types
```

## 3. Query Best Practices

- Always query tickets with indexes on `ticketNumber`, `status`, `priority`, `customerId`, `orderId`, and `assignedAgentId`.
- When fetching detailed tickets for customers, use Prisma's `where: { isInternalNote: false }` filter to guarantee internal note isolation at the database level.
