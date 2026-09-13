# `@repo/inventory-db`

PostgreSQL schema and transactional inventory primitives for Larekmart. PostgreSQL is
the source of truth for available, reserved, and sold stock. Redis and Kafka are
integration concerns of a future inventory service, not authoritative stores here.

## Data model

- `InventoryItem`: product variant stock per warehouse, with `quantity`,
  `availableQuantity`, `reservedQuantity`, `soldQuantity`, `reorderPoint`, `status`,
  and an optimistic `version`.
- `InventoryReservation`: checkout reservation and lifecycle status.
- `InventoryMovement`: append-only audit ledger for stock changes and references.

The quantity invariant is:

```text
quantity = availableQuantity + reservedQuantity + soldQuantity
```

A reservation moves available stock to reserved stock. Confirmation moves reserved
stock to sold stock. Release moves reserved stock back to available stock.

## Public API

- `createInventoryItem`, `getInventoryItem`, `listInventoryItems`
- `reserveInventory`
- `confirmInventoryReservation`, `releaseInventoryReservation`, `expireInventoryReservation`
- `restockInventory`, `adjustInventory`
- `listLowStockInventory`, `listInventoryMovements`
- Prisma client and generated Prisma types

`reserveInventory` uses a conditional atomic update inside a transaction, requiring
`availableQuantity >= requested` and creating the reservation and `RESERVE` ledger row
in the same transaction. It cannot oversell because concurrent callers cannot both
successfully update the same available quantity past zero.

All reservation transitions and stock mutations write their ledger rows in the same
transaction as the state change. Services should publish Kafka events only after the
transaction commits.

## Database commands

```bash
pnpm --filter @repo/inventory-db db:generate
pnpm --filter @repo/inventory-db db:migrate
pnpm --filter @repo/inventory-db db:deploy
pnpm --filter @repo/inventory-db check-types
```

Set `DATABASE_URL` to the inventory PostgreSQL database. Do not reuse a product-service
migration history for this schema without an explicit database ownership decision.
