# @repo/support-db

Database package providing the Prisma Client and PostgreSQL schema for the **Larekmart Customer Support & SLA Engine** (`support-service`).

## Database Target

- **Database Engine:** PostgreSQL 16
- **Database Name:** `larekmart_support_db`
- **Schema Location:** `prisma/schema.prisma`

## Schema Models

- `Ticket`: Core support ticket entity with ticket number (`TKT-YYYY-XXXXX`), status, priority, SLA deadlines, customer/seller/order/return references, and escalation indicators.
- `TicketMessage`: Public customer responses and private internal staff notes (`isInternalNote: true`) with JSON media attachments.
- `TicketAssignment`: History of agent assignments and support team queues (`TIER_1`, `TIER_2`, `BILLING`, `SELLER_OPS`, `ESCALATIONS`, `LOGISTICS`).
- `TicketCategory`: Dynamic ticket categories with default priorities and linked SLA policies.
- `TicketSlaPolicy`: Configured SLA response time and resolution thresholds.
- `TicketHistory`: Immutable audit trail for every status, priority, and assignment change.

## Usage

```typescript
import { prisma, TicketStatus, TicketPriority } from "@repo/support-db";

const openTickets = await prisma.ticket.findMany({
  where: { status: "OPEN" },
  include: { messages: true, category: true },
});
```

## Commands

```bash
# Generate Prisma Client
pnpm --filter @repo/support-db db:generate

# Apply Migrations
pnpm --filter @repo/support-db db:migrate

# Type-check
pnpm --filter @repo/support-db check-types
```
