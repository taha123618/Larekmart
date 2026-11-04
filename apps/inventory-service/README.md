# Inventory Service (`apps/inventory-service`)

Hono HTTP microservice for stock availability, warehouse inventory, checkout reservations,
reservation confirmation/release/expiry, restocks, adjustments, low-stock alerts, and inventory
events.

PostgreSQL remains the single authoritative source of truth through `@repo/inventory-db`.
Redis only caches availability reads with namespace-versioned cache invalidation, and Kafka
only distributes committed inventory events.

## API Endpoints

Customer-facing routes:

- `GET /api/v1/inventory/:productId` — read inventory availability (cached)
- `GET /api/v1/inventory/:productId/availability` — explicit availability check (cached)
- `POST /api/v1/inventory/reservations` — atomically reserve stock during checkout
- `POST /api/v1/inventory/reservations/:id/confirm` — transition reservation to confirmed (sale)
- `POST /api/v1/inventory/reservations/:id/release` — release reserved units back to available stock
- `POST /api/v1/inventory/reservations/:id/expire` — expire individual reservation

Admin routes (`shouldBeAdmin` required):

- `GET /api/v1/inventory/low-stock` — list items with low or zero available stock
- `GET /api/v1/inventory/movements` — inspect the append-only inventory audit ledger (filters: `productId`, `variantId`, `warehouseId`, `type`, `limit`, `cursor`)
- `GET /api/v1/inventory/movements/:productId` — inspect movements for a specific product
- `POST /api/v1/inventory/items` — initialize warehouse stock for a product variant
- `POST /api/v1/inventory/restock` — restock available units with audit movement
- `POST /api/v1/inventory/adjustments` — record stock adjustments, returns, damage write-offs
- `POST /api/v1/inventory/reservations/expire-stale` — trigger batch sweep of expired reservations

Operational routes:

- `GET /health` — health check for PostgreSQL and Redis
- `GET /ready` — readiness probe for traffic routing
- `GET /metrics` — Prometheus metrics (reservations, oversell prevention, restocks, adjustments, latency)

All request bodies are validated with Zod schemas from `@repo/types`. Customer mutations
derive the `userId` from verified Clerk claims.

## Concurrency & Flash-Sale Redis Stock Gatekeeper

To strictly prevent race conditions, overselling, and database connection pool starvation during high-velocity flash sales (e.g. 5,000+ req/sec):

### 1. Atomic Redis Pre-Check & Asynchronous Fast-Path (HTTP 202 Accepted)

Incoming checkout reservations (`POST /api/v1/inventory/reservations`) first pass through an atomic Redis Lua script (`RESERVE_LUA` in `src/gatekeeper/redis-stock-gatekeeper.ts`):

- **<1ms Fast Rejection**: If `availableQuantity < requestedQuantity`, the request is rejected immediately with HTTP 409 without touching PostgreSQL.
- **Cluster-Safe Dual-Token Hash Tagging**: All Redis keys strictly enforce structural `{tenant_id:warehouse_id}` hash tag pinning (e.g. `stock:available:{tenant_pk:pk_khi_01}:prod:var` and `stock:claim:{tenant_pk:pk_khi_01}:referenceId`). This guarantees that multi-key Lua executions (`RESERVE_LUA`, `ROLLBACK_LUA`) always map to identical CRC16 slots, completely preventing fatal `CROSSSLOT` exceptions when transitioning to distributed multi-node Redis clusters.
- **Atomic Claim & 202 Accepted**: If stock is available, Redis decrements the stock counter, registers a temporary claim token, and immediately responds with `HTTP 202 Accepted` (`{ status: "RESERVED", referenceId, expiresAt, ... }`).
- **Asynchronous Kafka Micro-Batch Queue**: Publishes `inventory.reservation.requested` to Kafka keyed by `${productId}:${variantId}`, serializing all reservations for that SKU onto a single partition.
- **Synchronous Fallback Mode**: Opt-in synchronous database persistence is available via `?sync=true` or `ASYNC_INVENTORY_RESERVATIONS=false` for tests or explicit sync workflows.

### 2. High-Throughput Reservation Batch Worker & PostgreSQL Coalescing

A dedicated worker (`src/workers/reservation-batch.worker.ts`) consumes `inventory.reservation.requested` in micro-batches (up to 50 items) via `@repo/kafka` `subscribeBatch()`:

```sql
UPDATE inventory_items
SET available_quantity = available_quantity - $batch_quantity,
    reserved_quantity = reserved_quantity + $batch_quantity,
    version = version + 1
WHERE product_id = $1 AND variant_id = $2 AND warehouse_id = $3
  AND status != 'INACTIVE'
  AND available_quantity >= $batch_quantity;
```

- **50x Lock Reduction**: Coalesces up to 50 concurrent single-unit reservations into a single database update statement, eliminating row-level lock serialization on hot viral SKUs.
- **Graceful Fallback**: If available stock is less than the total batch quantity, automatically falls back to item-by-item conditional decrements, allocating remaining stock fairly with zero oversell.
- **Compensation Rollback**: If PostgreSQL persistence fails or is rejected, an atomic compensation rollback (`ROLLBACK_LUA`) restores the claimed Redis counter and emits `inventory.reservation.failed`.

### 3. Dual-Action Release & Expiry

When reservations are released, cancelled, or expired:

- PostgreSQL updates the reservation and writes an audit ledger movement.
- Redis stock counters are atomically incremented (`INCREMENT_LUA`) and centralized read caches are synchronized.

## Reservation Accounting Invariant

For every inventory item:

```text
quantity = availableQuantity + reservedQuantity + soldQuantity
```

- Customer reserves 3 units: `available - 3`, `reserved + 3`, `sold 0`
- Payment succeeds: `available - 3`, `reserved - 3`, `sold + 3`
- Checkout cancels or expires: `available + 3`, `reserved - 3`, `sold 0`

## Automated Reservation Expiry Worker

A background worker runs every `RESERVATION_EXPIRY_SWEEP_INTERVAL_MS` (default 60 seconds) to
sweep past-due reservations, release units back to `availableQuantity` in PostgreSQL, write
`RELEASE` ledger movements, invalidate the Redis cache, and publish `inventory.reservation.expired`
Kafka events.

## Kafka Events

### Published Events

The service publishes the following events using the `{ value: payload }` envelope:

- `inventory.reservation.requested` (emitted on 202 Accepted fast-path claim)
- `inventory.created`
- `inventory.reserved`
- `inventory.reservation.confirmed`
- `inventory.reservation.failed` (emitted on reservation rejection or compensation failure)
- `inventory.stock.sold`
- `inventory.released`
- `inventory.reservation.expired`
- `inventory.restocked`
- `inventory.adjusted`
- `inventory.low_stock` (emitted when available stock is at or below reorder point)

### Consumed Events

The service subscribes to cross-service and asynchronous events:

- `inventory.reservation.requested` — Consumed in micro-batches (up to 50 items) by the reservation batch worker using `@repo/kafka` `subscribeBatch()` to coalesce database row updates.
- `payment.successful` — When a customer completes checkout in `payment-service` (via Stripe webhook), `inventory-service` consumes this event and confirms matching reservations in PostgreSQL, converting reserved stock to sold stock and publishing `inventory.stock.sold`.

## Local Development & Testing

```bash
pnpm --filter inventory-service dev
pnpm --filter inventory-service check-types
pnpm --filter inventory-service test
pnpm --filter inventory-service build
```

Database migrations:

```bash
pnpm --filter @repo/inventory-db db:generate
pnpm --filter @repo/inventory-db db:migrate
```
