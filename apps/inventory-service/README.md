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

### 1. Atomic Redis Pre-Check (Gatekeeper Fast-Path)

Incoming checkout reservations (`POST /api/v1/inventory/reservations`) first pass through an atomic Redis Lua script (`RESERVE_LUA` in `src/gatekeeper/redis-stock-gatekeeper.ts`):

- **<1ms Fast Rejection**: If `availableQuantity < requestedQuantity`, the request is rejected immediately with HTTP 409 without touching PostgreSQL.
- **Cluster-Safe Dual-Token Hash Tagging**: All Redis keys strictly enforce structural `{tenant_id:warehouse_id}` hash tag pinning (e.g. `stock:available:{tenant_pk:pk_khi_01}:prod:var` and `stock:claim:{tenant_pk:pk_khi_01}:referenceId`). This guarantees that multi-key Lua executions (`RESERVE_LUA`, `ROLLBACK_LUA`) always map to identical CRC16 slots, completely preventing fatal `CROSSSLOT` exceptions when transitioning to distributed multi-node Redis clusters.
- **Atomic Claim**: If stock is available, Redis decrements the stock counter and registers a temporary claim token (`stock:claim:{tenant_id:warehouse_id}:referenceId`) with a 60-second TTL.
- **Cold-Start Protection**: If the counter is missing in Redis, a 2-second distributed mutex (`stock:lock:{tenant_id:warehouse_id}:prod:var`) loads ground truth from PostgreSQL once and initializes the counter, protecting the DB from thundering herds.

### 2. PostgreSQL Authoritative Ledger & Compensation Rollback

Once the Redis claim is granted, the reservation is committed to PostgreSQL:

```sql
UPDATE inventory_items
SET available_quantity = available_quantity - $quantity,
    reserved_quantity = reserved_quantity + $quantity,
    version = version + 1
WHERE product_id = $1 AND variant_id = $2 AND warehouse_id = $3
  AND status != 'INACTIVE'
  AND available_quantity >= $quantity;
```

- If the PostgreSQL transaction succeeds: The temporary claim token is finalized and deleted.
- If the PostgreSQL transaction fails or times out: An atomic compensation rollback (`ROLLBACK_LUA`) immediately increments the Redis counter back by the claimed quantity, preventing phantom stock loss.

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

The service publishes the following events using the `{ value: payload }` envelope after successful PostgreSQL transactions:

- `inventory.created`
- `inventory.reserved`
- `inventory.reservation.confirmed`
- `inventory.stock.sold`
- `inventory.released`
- `inventory.reservation.expired`
- `inventory.restocked`
- `inventory.adjusted`
- `inventory.low_stock` (emitted when available stock is at or below reorder point)

### Consumed Events

The service subscribes to cross-service events:

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
