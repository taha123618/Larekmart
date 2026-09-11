# AGENTS.md — apps/analytic-service (analytics service & worker)

Scope: `apps/analytic-service` only. Root rules still apply — start there.

## What this service is

A hybrid Kafka consumer worker and Express HTTP API service that listens to all primary event streams across the Larekmart e-commerce microservices platform (`payment.successful`, `order.created`, `user.created`, `product.created`, `product.deleted`), updates real-time in-memory counters, persists event audit logs and daily aggregations into PostgreSQL, and serves analytics endpoints to the Admin dashboard.

## Where things live

- `src/index.ts` — worker & HTTP bootstrap, Kafka client/consumer creation, Express server on port `8004`.
- `src/db.ts` — PostgreSQL connection pool (`pg.Pool`), automatic table initialization (`analytics_events`, `analytics_daily_summary`), and database health status tracker.
- `src/services/metrics.service.ts` — business logic for processing and recording metrics, DB persistence, in-memory fallback, and query methods for summary/charts/events.
- `src/routes/analytics.route.ts` — REST API routes for `/analytics/summary`, `/analytics/daily-chart`, and `/analytics/events`.
- `src/middleware/authMiddleware.ts` — Clerk admin authentication guards (`shouldBeAdmin`).

## Framework and style

- Express 5 on port `8004`.
- ESM (`"type": "module"`).
- Local imports use explicit `.js` extensions (Node ESM conventions).

## Kafka integration

- Use `@repo/kafka` (`createKafkaClient`, `createConsumer`); do not instantiate `kafkajs` directly.
- Consumer group ID: `analytic-service-group`.
- Subscriptions handle both `{ value: payload }` envelope and raw payload formats (`message.value || message`).
- Event topics subscribed:
  - `payment.successful` (and alias `payment-successful`)
  - `order.created` (and alias `order-successful`)
  - `user.created` (and alias `email-successful`)
  - `product.created`
  - `product.deleted`
- If modifying topic contracts, update the producer, all consumers, `@repo/types`, and `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.

## Database & Persistence

- Uses `pg.Pool` directly for lightweight, non-blocking inserts and queries.
- Handles PostgreSQL offline / connection failures gracefully with in-memory accumulation so Kafka consumption and HTTP reads continue operating.
- Never commit database credentials; use `DATABASE_URL` from `.env`.

## Error handling

- Kafka handlers must catch and log errors safely to prevent consumer crash loops.
- Handle payload schema mismatches with defensive null/undefined checks.

## Verification

- `pnpm --filter analytic-service check-types`
- Local testing with Kafka compose and PostgreSQL.
