# AGENTS.md — apps/order-service (orders + analytics)

Scope: `apps/order-service` only. Root rules still apply — start there.

## What this service is

Fastify 5 service on `:8001`. It owns orders and order analytics in MongoDB via Mongoose.
It consumes `payment.successful` to create orders and publishes `order.created` for email.

## Where things live

- `src/index.ts` — Fastify bootstrap, plugins, routes, auth, health, and test route.
- `src/routes/` — order routes.
- `src/middleware/` — auth middleware (`shouldBeUser`, `shouldBeAdmin`) via `@clerk/fastify`.
- `src/cache/order-chart-cache.ts` — Redis read-through cache for the order chart.
- `src/observability/metrics.ts` — service logger, metrics registry, and cache counters.
- `src/utils/` — order creation logic, the Redis handle (`redis.ts`), and Kafka subscriptions.

## Framework and style

- Fastify 5, ESM (`"type": "module"`).
- Route registration uses the plugin-function pattern where the existing code does.
- Auth is applied per-route with `preHandler: shouldBeUser | shouldBeAdmin`.
- Local imports use explicit `.js` extensions where the file already does; match the file
  you are editing.

## Auth and authorization

- Clerk via `@clerk/fastify`.
- User-scoped routes use `shouldBeUser`; admin routes use `shouldBeAdmin`.
- Existing protected routes include user orders, admin orders, and the order chart.
- Derive `userId` from the session; do not trust a client-supplied `userId`.

## Persistence

- Mongoose via `@repo/order-db`. Use `Order`, `OrderStatus`, `OrderSchemaType`, `OutboxEvent`,
  and `connectOrderDB` as the public surface.
- Outbox collection (`OutboxEvent`) records all lifecycle events inside atomic MongoDB transactions
  alongside `Order` document changes to guarantee zero event loss (Transactional Outbox pattern).
- Do not create ad-hoc Mongo clients or bypass the shared model.
- Order statuses: `success | failed` in the existing model.

## Caching

- All Redis access goes through `@repo/redis`; `src/utils/redis.ts` declares the handle with
  `createRedisService`, and `src/cache/order-chart-cache.ts` holds the cache. Do not import
  `ioredis` here.
- Use `redis.client` with the `cacheRead`/`cacheSet` helpers and `redis.keys` to compose keys.
  Cache counters (`cache_hits_total` / `cache_misses_total` / `cache_errors_total`,
  `cache_type: "order-chart"`) come from `createCacheMetrics` in `src/observability/metrics.ts`,
  which also owns the service logger and metrics registry, and surface at `/metrics`. Read through
  `cacheRead` so the outcome can be classified — an unreachable Redis is an **error, not a miss**.
- Cached: `GET /order-chart` only. It is **TTL-bounded, not invalidated on write** — orders arrive
  continuously, so bumping a namespace version per order would invalidate the entry faster than the
  dashboard reads it. For data that changes rarely, prefer product-service's namespace-version
  invalidation instead.
- Redis is optional: a miss falls through to the MongoDB aggregation, and `/health` reports Redis
  as `degraded` rather than failing the service.
- Config: `REDIS_URL`, `REDIS_KEY_PREFIX`, `ORDER_CHART_CACHE_TTL_SECONDS` (see `.env.example`).

## Events & Transactional Outbox

- Consume Kafka through `@repo/kafka`.
- Current subscriptions from this service: `payment.successful` → order creation.
- **Transactional Outbox Relay (`src/outbox/outbox-relay.ts`)**:
  - Always publish domain events via `dispatchViaOutbox(topic, payload, { session })`.
  - Fast path: If published outside an active transaction session, the event is immediately sent to Kafka and marked `PUBLISHED`.
  - Transaction path: When executed within a MongoDB ClientSession, the event is persisted into `OutboxEvent` within the same transaction. Upon commit, it is either dispatched immediately or swept asynchronously.
  - Distributed Leader Election: Backed by `DistributedLeaderElector` from `@repo/redis` (`order:outbox:sweeper:leader`, 10s lease TTL, 3s heartbeat renewal). Guarantees that horizontally scaled order-service pods never execute concurrent duplicate sweeper batches. Exactly one active Leader runs the background sweeper loop while follower replicas remain in hot standby mode (0 polling overhead).
  - Background Sweeper: Runs periodically on the elected leader (default 5s) to claim un-dispatched or failed events with an atomic 30s distributed lease lock (`lockedUntil`) and worker fencing to ensure at-least-once delivery without duplicate stream emissions.
  - Failover: If the active leader container shuts down or crashes, standby replicas detect the expired/released lease and seamlessly elect a new leader.
  - Retention: Events are automatically pruned after 7 days via MongoDB TTL index on `publishedAt`.
- This service publishes `order.created`, `order.confirmed`, `order.cancelled`, `payment.refund.requested`, `inventory.reservation.cancelled`, and `tax.calculation.voided`.
- Use the `{ value: payload }` envelope and read `message.value` in handlers.
- Because subscriptions use `fromBeginning: true`, handlers must be tolerant of re-processing.
- If you change a payload, update the producer, every consumer, `@repo/types`, and
  `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.

## Distributed Idempotency Key Engine

- State-mutating routes (such as `POST /orders/cod`) are wrapped with `executeWithIdempotency` (`src/middleware/idempotency.ts`).
- Respects the IETF `Idempotency-Key` header.
- Uses atomic Redis locking (`acquireIdempotencyLock` / `commitIdempotencyResponse` from `@repo/redis`):
  - In-flight execution sets atomic lease lock; concurrent duplicates receive `409 Conflict`.
  - Completed execution caches `{ statusCode, body }` with 24h TTL; subsequent retries transparently replay the response with `Idempotent-Replayed: true` without duplicating database writes or Kafka events.
  - Handler errors release the lock, allowing legitimate retries.

## Error handling

- Return `{ message }` JSON with the correct status.
- Kafka handlers must catch and log so a bad message does not kill the consumer loop.
- Outbox events retry with exponential backoff up to 5 attempts before remaining in `FAILED` state for dead-letter review.

## Health and observability

- Expose `GET /health` (health registry, aggregated report) and `GET /metrics` (Prometheus).
- Logging uses `@repo/monitoring`'s `createLogger`, owned by `src/observability/metrics.ts`.

## What not to do

- Do not add a different web framework.
- Do not access product/Postgres data here.
- Do not import frontend code.
- Do not hardcode service URLs or secrets outside env vars.

## Verification

- `pnpm --filter order-service check-types`
- `pnpm --filter order-service test` (runs `order-security`, `checkout-saga`, `transactional-outbox`, and `idempotency` test suites)
- Manual flows against running MongoDB + Kafka.
