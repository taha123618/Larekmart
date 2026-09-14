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

## Concurrency & Oversell Prevention

To strictly prevent race conditions and overselling:

```sql
UPDATE inventory_items
SET available_quantity = available_quantity - $quantity,
    reserved_quantity = reserved_quantity + $quantity,
    version = version + 1
WHERE product_id = $1 AND variant_id = $2 AND warehouse_id = $3
  AND status != 'INACTIVE'
  AND available_quantity >= $quantity;
```

PostgreSQL row-level locking ensures that concurrent checkout requests evaluate available stock
atomically. If stock is insufficient, the operation fails cleanly with an `Insufficient inventory`
error, increments `inventory_oversell_prevented_total`, and returns HTTP 409.

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

## Local Development

```bash
pnpm --filter inventory-service dev
pnpm --filter inventory-service check-types
pnpm --filter inventory-service build
```

Database migrations:

```bash
pnpm --filter @repo/inventory-db db:generate
pnpm --filter @repo/inventory-db db:migrate
```
