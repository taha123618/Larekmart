# Inventory Service (`apps/inventory-service`)

Hono service for stock availability, warehouse inventory, checkout reservations,
reservation confirmation/release, restocks, adjustments, low-stock alerts, and inventory
events.

PostgreSQL remains the source of truth through `@repo/inventory-db`. Redis only caches
availability reads, and Kafka only distributes committed inventory events.

## API

Customer-facing routes:

- `GET /api/v1/inventory/:productId`
- `GET /api/v1/inventory/:productId/availability`
- `POST /api/v1/inventory/reservations`
- `POST /api/v1/inventory/reservations/:id/confirm`
- `POST /api/v1/inventory/reservations/:id/release`
- `POST /api/v1/inventory/reservations/:id/expire`

Admin routes:

- `POST /api/v1/inventory/items`
- `POST /api/v1/inventory/restock`
- `POST /api/v1/inventory/adjustments`
- `GET /api/v1/inventory/admin/low-stock`
- `GET /api/v1/inventory/admin/movements/:productId`

Operational routes:

- `GET /health`
- `GET /ready`
- `GET /metrics`

All request bodies are validated with schemas from `@repo/types`. Customer mutations
use the verified Clerk user ID; it is never accepted from the request body.

## Reservation accounting

For every inventory item:

```text
quantity = availableQuantity + reservedQuantity + soldQuantity
```

A reservation atomically moves stock from available to reserved. Confirmation moves it
to sold. Release or expiry returns it to available. The database migration also enforces
nonnegative quantities and this accounting identity.

## Events

The service publishes these topics after successful PostgreSQL transactions:

- `inventory.created`
- `inventory.reserved`
- `inventory.reservation.confirmed`
- `inventory.released`
- `inventory.reservation.expired`
- `inventory.restocked`
- `inventory.adjusted`
- `inventory.low_stock` when available stock reaches the reorder point or below

Every message uses the `{ value: payload }` envelope.

## Local development

```bash
pnpm --filter inventory-service dev
pnpm --filter inventory-service check-types
pnpm --filter inventory-service build
```

Set up the database schema first:

```bash
pnpm --filter @repo/inventory-db db:generate
pnpm --filter @repo/inventory-db db:migrate
```

The default local port is `8007`. Copy `.env.example` to `.env` and configure Clerk,
PostgreSQL, Redis, and Kafka access.
