# AGENTS.md — apps/support-service

Scope: `apps/support-service` only. Root rules still apply — start there.

## What this service is

NestJS 11 microservice running with the Fastify platform adapter (`@nestjs/platform-fastify`) on port 8025.
It provides enterprise customer, seller, and administrator support ticket management, SLA policies, escalation policies, internal notes and public replies with media attachments, agent assignment queues, workload views, resolution analytics, Kafka event notifications, and Socket.IO real-time event broadcasting.

**Crucial Separation of Concerns:**

- `support-service`: Owns support ticket state, workflows, SLAs, assignments, history, and ticket messages.
- `chat-service`: Owns live message transport for real-time customer conversations.
- `media-service`: Owns attachment storage; `support-service` references uploaded media URLs and metadata.

## Architecture & Layers

- `src/main.ts` — NestJS bootstrap running FastifyAdapter on port 8025 with CORS, WAL LSN tracking, and Socket.IO gateway initialization.
- `src/config/env.ts` — Zod validated configuration (`PORT=8025`, `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `GATEWAY_INTERNAL_SECRET`).
- `src/database/` — Global `DatabaseModule` with lifecycle-managed `PrismaService` backed by `@repo/support-db`.
- `src/kafka/` — `KafkaModule` and `KafkaService` publishing typed events using the `{ value: payload }` envelope.
- `src/redis/` — `RedisModule` and `RedisService` caching ticket data via `@repo/redis`.
- `src/realtime/` — `RealtimeModule` and `RealtimeService` using Socket.IO for live queue, assignment, and ticket updates.
- `src/common/` —
  - `guards/`: `AuthGuard` (`x-user-id` validated against trusted gateway in production), `AdminGuard` (`role === "admin" / "super_admin"` or `isSuper` with timing-safe gateway check).
  - `filters/`: `HttpExceptionFilter` ensuring RFC-compliant and consistent `{ message, errors }` responses.
- `src/modules/` —
  - `tickets/`: `TicketsService`, `TicketsController`, `AdminTicketsController`, `TicketsModule` handling ticket creation, retrieval, updates, messages, assignments, escalations, and analytics.
  - `categories/`: `CategoriesService`, `CategoriesController`, `CategoriesModule` managing ticket categories.
  - `sla/`: `SlaService`, `SlaController`, `SlaModule` managing SLA policies.
- `src/health/` — `HealthController` providing `/health`, `/ready`, and `/metrics`.

## API Endpoints

- Authenticated Endpoints (`AuthGuard`):
  - `POST /api/v1/support/tickets` — Create a support ticket (customer, seller, admin).
  - `GET /api/v1/support/tickets` — List tickets with filtering, pagination, and role-based scoping.
  - `GET /api/v1/support/tickets/:id` — Get ticket details, messages (internal notes redacted for non-admins), assignments, and history.
  - `POST /api/v1/support/tickets/:id/messages` — Add a message or internal note (internal notes restricted to staff/admins).
  - `PATCH /api/v1/support/tickets/:id` — Update ticket status or metadata.
  - `GET /api/v1/support/categories` — List active ticket categories.

- Admin Endpoints (`AuthGuard`, `AdminGuard`):
  - `POST /api/v1/admin/support/tickets/:id/assign` — Assign ticket to an agent / support team.
  - `POST /api/v1/admin/support/tickets/:id/escalate` — Escalate ticket to specialized team (e.g. ESCALATIONS).
  - `GET /api/v1/admin/support/analytics` — Agent workload, queue distribution, and SLA resolution metrics.
  - `GET /api/v1/admin/support/sla-policies` — List SLA policies.
  - `POST /api/v1/admin/support/sla-policies` — Create/update SLA policy.

## Kafka Events

- **Produced:**
  - `support.ticket.created`
  - `support.ticket.assigned`
  - `support.ticket.updated`
  - `support.ticket.resolved`
- **Consumed (`SupportConsumerService`):**
  - `return.rejected` — Automatically provisions arbitration ticket for customer appeal.
  - `dispute.created` — Automatically creates mediation ticket for buyer-seller disputes.
  - `fraud.case.escalated` — Automatically generates critical security investigation ticket.

## Testing & Quality Gates

```bash
# Run 14-test integration and SLA suite
pnpm --filter support-service test

# TypeScript type check
pnpm --filter support-service check-types
```
