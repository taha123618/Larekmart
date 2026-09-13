# AGENTS.md — apps/inventory-service

Scope: `apps/inventory-service` only. Root rules still apply — start there.

## What this service is

Hono HTTP service for inventory availability, reservations, stock deductions, restocks,
adjustments, low-stock reporting, and inventory events. It owns no database directly;
all inventory state is persisted through `@repo/inventory-db` in PostgreSQL.

## Source-of-truth boundary

- PostgreSQL is authoritative for `availableQuantity`, `reservedQuantity`, and
  `soldQuantity`.
- Redis is read-through availability caching only. A Redis outage must fall through to
  PostgreSQL and appear as a degraded dependency, never as a stock decision.
- Kafka distributes committed inventory events. Kafka delivery must not be used to decide
  whether a reservation succeeds.
- Do not add direct calls to product, order, payment, or frontend code.

## Routes

- Customer routes under `/api/v1/inventory`: availability, reservation, confirm, release,
  and expiration. Reservation lifecycle operations are scoped to the Clerk user ID stored
  on the reservation.
- Admin routes: create inventory items, restock, adjustments, low-stock listing, and
  movement history.
- Operational routes: `/health`, `/ready`, `/metrics`.

## Concurrency and events

- Use `@repo/inventory-db` operations; never read a quantity and then write an
  unconditional replacement.
- Reservations use a conditional atomic update requiring sufficient available stock.
- Publish `inventory.*` Kafka events only after the database transaction commits. Event
  publication is observable but does not make Redis or Kafka authoritative.
- Use `{ value: payload }` when publishing and keep handlers/event consumers defensive.

## Security

- Clerk is the only authentication system.
- Derive `userId` from verified Clerk claims. Never accept a client-supplied user ID.
- Admin-only stock setup and adjustment routes use `shouldBeAdmin`.
- Reservation transitions use the authenticated reservation owner.

## Verification

```bash
pnpm --filter inventory-service check-types
pnpm --filter inventory-service build
pnpm --filter @repo/inventory-db db:generate
pnpm check-types
```

A running PostgreSQL and Redis are required for live service verification. No service-level
JavaScript test runner is configured yet.
