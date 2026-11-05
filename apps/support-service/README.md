# Support Service (`support-service`)

Production-ready NestJS 11 + Fastify 5 microservice on **port 8025** providing omnichannel customer, seller, and administrator support ticket management, SLA policies, escalation policies, internal notes and public replies with media attachments, agent queues, workload analytics, and real-time Socket.IO broadcasts across Larekmart.

## Features

- **Omnichannel Ticket Management**: Multi-actor submissions (Customer, Seller, Admin, System) linked to orders, payments, returns, and sellers.
- **SLA Engine**: Dynamic first-response and resolution deadlines calculated per priority and category policy.
- **Role-based Message Privacy**: Public customer replies alongside strictly redacted internal staff notes (`isInternalNote: true`).
- **Escalation & Assignment**: Tiered support assignments (`TIER_1`, `TIER_2`, `BILLING`, `SELLER_OPS`, `ESCALATIONS`, `LOGISTICS`) with audit trail history.
- **Real-Time Updates**: Socket.IO gateway broadcasting live ticket events and agent queue updates.
- **Kafka Integration**: Publishes domain events (`support.ticket.created`, `support.ticket.assigned`, `support.ticket.updated`, `support.ticket.resolved`) and consumes cross-domain events (`return.rejected`, `dispute.created`, `fraud.case.escalated`) using the standard `{ value: payload }` envelope.
- **Zero-Trust Security**: Validates internal gateway secrets in constant time and derives actor identities from verified gateway headers.
- **WAL LSN Emission**: Emits `x-db-lsn` response headers for Read-Your-Writes replica lag protection.

## Port & Infrastructure

- **HTTP Port:** 8025
- **Socket.IO Path:** `/socket.io`
- **Database:** PostgreSQL (`larekmart_support_db`) via `@repo/support-db`
- **Cache & Locks:** Redis (`@repo/redis`)
- **Event Bus:** Apache Kafka (`@repo/kafka`)

## Key API Endpoints

### Storefront / Customer (`/api/v1/support`)

- `POST   /tickets` — Create customer support ticket
- `GET    /tickets` — List customer's own support tickets
- `GET    /tickets/:id` — Get detailed ticket timeline (internal notes redacted)
- `POST   /tickets/:id/messages` — Post reply to open ticket
- `PATCH  /tickets/:id` — Update ticket status
- `GET    /categories` — List active support categories

### Operations / Admin (`/api/v1/admin/support`)

- `GET    /tickets` — Global ticket registry with filters (status, priority, team, agent)
- `GET    /tickets/:id` — Full ticket entity with staff notes and audit logs
- `POST   /tickets/:id/messages` — Post reply or private internal staff note
- `POST   /tickets/:id/assign` — Assign ticket to agent or support team queue
- `POST   /tickets/:id/escalate` — Escalate ticket priority with reason
- `GET    /sla-policies` — List SLA configuration policies
- `GET    /analytics` — Resolution analytics, SLA breach rates, and agent workloads

## Verification & Tests

```bash
# Run unit & integration test suite (14/14 tests)
pnpm --filter support-service test

# Type-check
pnpm --filter support-service check-types
```
