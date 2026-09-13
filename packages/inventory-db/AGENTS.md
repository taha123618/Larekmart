# AGENTS.md — packages/inventory-db

Scope: `packages/inventory-db` only. Root rules still apply — start there.

## What this package is

`@repo/inventory-db` owns the PostgreSQL schema and transactional persistence primitives
for stock, reservations, and inventory movements. PostgreSQL is the inventory source of
truth. Redis may cache reads in a service, and Kafka may distribute events, but neither
belongs in this package or may authorize a stock mutation.

## Data model

- `InventoryItem` stores product/variant/warehouse stock, available quantity, reserved
  quantity, sold quantity, reorder point, status, and an optimistic version.
- `InventoryReservation` tracks a checkout reservation and its lifecycle:
  `RESERVED`, `CONFIRMED`, `RELEASED`, or `EXPIRED`.
- `InventoryMovement` is the append-only audit ledger for `PURCHASE`, `RESTOCK`,
  `RESERVE`, `RELEASE`, `SALE`, `RETURN`, `ADJUSTMENT`, and `DAMAGE` movements.

The package keeps the accounting invariant `quantity = availableQuantity +
reservedQuantity + soldQuantity`. Reservation confirmation moves units from reserved to
sold; release moves them back to available.

## Concurrency rules

- Reserve through `reserveInventory`; it performs a conditional atomic update requiring
  `availableQuantity >= requested` inside a database transaction.
- Confirm or release through the reservation transition helpers. They are idempotency-safe
  at the state transition boundary because only an active `RESERVED` reservation can move.
- Run `expireInventoryReservation` from a scheduled worker for reservations whose expiry
  time has passed; it returns stock to availability and marks the reservation `EXPIRED`.
- Create the ledger movement in the same transaction as the stock mutation.
- Do not read stock, make a decision in application code, and then write an unconditional
  replacement quantity.
- Do not publish Kafka events or call Redis from this package. Services publish events only
  after the database transaction succeeds and should use an outbox when delivery guarantees
  are required.

## Schema and verification

- Source of truth: `prisma/schema.prisma`.
- Never edit `generated/prisma/**`; regenerate it from the schema.
- Generate: `pnpm --filter @repo/inventory-db db:generate`.
- Migrate locally: `pnpm --filter @repo/inventory-db db:migrate`.
- Deploy migrations: `pnpm --filter @repo/inventory-db db:deploy`.
- Type-check: `pnpm --filter @repo/inventory-db check-types`.

This package does not own HTTP routes. `inventory-service` exposes API handlers and
authentication, then calls these package operations with verified input.
