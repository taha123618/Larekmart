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
  - `review.created`
  - `review.approved`
  - `review.reported`
  - `product.rating-summary.updated`
  - `promotion.created`
  - `promotion.activated`
  - `promotion.deactivated`
  - `promotion.budget_exhausted`
  - `promotion.reserved`
  - `promotion.redeemed`
  - `promotion.released`
- If modifying topic contracts, update the producer, all consumers, `@repo/types`, and `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.

## Database & Persistence

- Uses `pg.Pool` directly for lightweight, non-blocking inserts and queries.
- Handles PostgreSQL offline / connection failures gracefully with in-memory accumulation so Kafka consumption and HTTP reads continue operating.
- Never commit database credentials; use `DATABASE_URL` from `.env`.

## Caching

- All Redis access goes through `@repo/redis`; `src/utils/redis.ts` declares the handle with
  `createRedisService`, and `src/cache/analytics-cache.ts` holds the dashboard cache. Do not
  import `ioredis` here.
- Use `redis.client` with the `cacheRead`/`cacheSet` helpers and `redis.keys` to compose keys.
  Cache counters (`cache_hits_total` / `cache_misses_total` / `cache_errors_total`, `cache_type`
  labels) come from `createCacheMetrics` in `src/observability/metrics.ts`, which also owns the
  service logger and metrics registry, and surface at `/metrics`. Read through `cacheRead` so the
  outcome can be classified — an unreachable Redis is an **error, not a miss**.
- Cached (read-through): `getDailyAnalytics` and `getRecentEvents`. Call those exported
  functions — the private `readDailyAnalytics` / `readRecentEvents` helpers bypass the cache.
- Entries are **TTL-bounded, not invalidated on write**: events arrive continuously, so a
  namespace bump per event would invalidate faster than the dashboard reads. Keep the windows
  short and configurable via `ANALYTICS_CHART_CACHE_TTL_SECONDS` /
  `ANALYTICS_EVENTS_CACHE_TTL_SECONDS`.
- Redis is optional: misses fall through to PostgreSQL and the in-memory counters, and
  `/health` reports Redis as `degraded` rather than failing the service.

## Error handling

- Kafka handlers must catch and log errors safely to prevent consumer crash loops.
- Handle payload schema mismatches with defensive null/undefined checks.

## Verification

- `pnpm --filter analytic-service check-types`
- Local testing with Kafka compose and PostgreSQL.
