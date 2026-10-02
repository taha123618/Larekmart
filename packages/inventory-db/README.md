# `@repo/inventory-db`

Production-grade database and persistence layer for Larekmart's inventory management system. Built with **TypeScript**, **Prisma ORM**, and **PostgreSQL**.

PostgreSQL is the **single, authoritative source of truth** for all stock quantities, warehouse allocations, reservations, and movement audits. Redis (read-through caching) and Kafka (asynchronous event distribution) must never become authoritative sources for inventory quantities.

---

## 1. Core Architecture & Design Principles

```text
                    ┌─────────────────────┐
                    │  inventory-service  │
                    │                     │
                    │  Hono HTTP API      │
                    │  Redis (Cache Reads)│
                    │  Kafka (Events)     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ packages/           │
                    │ inventory-db        │
                    │                     │
                    │  Prisma Client      │
                    │  Atomic Txns        │
                    │  Append-Only Ledger │
                    │  Multi-Warehouse    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     PostgreSQL      │
                    │                     │
                    │ Single Source Truth │
                    │                     │
                    │ warehouses          │
                    │ inventory_items     │
                    │ reservations        │
                    │ movements           │
                    └─────────────────────┘
```

### Triple-Quantity Accounting Invariant

The schema and persistence layer strictly maintain the invariant:

$$\text{quantity} = \text{availableQuantity} + \text{reservedQuantity} + \text{soldQuantity}$$

Where:

- $\text{quantity} \ge 0$: Total tracked physical stock units.
- $\text{availableQuantity} \ge 0$: Units available to be reserved or sold.
- $\text{reservedQuantity} \ge 0$: Units temporarily held in active checkout reservations.
- $\text{soldQuantity} \ge 0$: Units confirmed as purchased.

Enforced at the database level via PostgreSQL `CHECK` constraints:

```sql
ALTER TABLE "inventory_items"
    ADD CONSTRAINT "inventory_items_nonnegative_quantities_check"
    CHECK ("quantity" >= 0 AND "reservedQuantity" >= 0 AND "soldQuantity" >= 0 AND "availableQuantity" >= 0 AND "reorderPoint" >= 0),
    ADD CONSTRAINT "inventory_items_quantity_breakdown_check"
    CHECK ("quantity" = "availableQuantity" + "reservedQuantity" + "soldQuantity");
```

#### State Transitions Example:

| Step                        | Operation          | Total (`quantity`) | Available | Reserved | Sold | Ledger Movement                            |
| :-------------------------- | :----------------- | :----------------: | :-------: | :------: | :--: | :----------------------------------------- |
| 1. Initial Restock          | Setup 100 units    |        100         |    100    |    0     |  0   | `PURCHASE` (+100)                          |
| 2. Checkout Started         | Reserve 3 units    |        100         |    97     |    3     |  0   | `RESERVE` (+3)                             |
| 3. Payment Confirmed        | Confirm sale       |        100         |    97     |    0     |  3   | `SALE` (+3)                                |
| 4. Second Checkout          | Reserve 2 units    |        100         |    95     |    2     |  3   | `RESERVE` (+2)                             |
| 5. Checkout Abandoned       | Expire/Release     |        100         |    97     |    0     |  3   | `RELEASE` (+2)                             |
| 6. Inter-Warehouse Transfer | Transfer 20 to WH2 |         80         |    77     |    0     |  3   | `TRANSFER_OUT` (-20) / `TRANSFER_IN` (+20) |

---

## 2. Preventing Overselling (Atomic Concurrency)

Never read available stock and perform an unconstrained application-side update:

```ts
// ❌ VULNERABLE TO RACE CONDITIONS
const item = await getInventoryItem(id);
if (item.availableQuantity >= requested) {
  await updateInventory(id, item.availableQuantity - requested);
}
```

Instead, `@repo/inventory-db` executes **atomic conditional updates inside PostgreSQL transactions**:

```sql
UPDATE inventory_items
SET available_quantity = available_quantity - $quantity,
    reserved_quantity = reserved_quantity + $quantity,
    version = version + 1
WHERE product_id = $productId
  AND variant_id = $variantId
  AND warehouse_id = $warehouseId
  AND status != 'INACTIVE'
  AND available_quantity >= $quantity;
```

PostgreSQL row-level locking guarantees that concurrent checkout requests evaluate available stock atomically without race conditions. If available stock is insufficient, the statement affects 0 rows, rolls back the transaction, and throws `InsufficientStockError`.

---

## 3. Warehouse Topology & Transfers

Inventory is warehouse-aware. A single product variant can be stocked independently across multiple facilities:

```text
Product 101 (Variant "L-Black")
├── Karachi Fulfillment Center   (main-warehouse)   → 100 units
├── Lahore Regional Hub          (lahore-wh)         → 50 units
└── Islamabad Distribution Port  (islamabad-wh)     → 25 units
```

### Atomic Warehouse Transfers

The `transferInventory()` repository operation coordinates stock migration between facilities in a single PostgreSQL transaction:

1. Atomically decrements `availableQuantity` and `quantity` at source warehouse (`availableQuantity >= requested`).
2. Atomically increments or creates inventory item at destination warehouse.
3. Simultaneously logs `TRANSFER_OUT` on source item and `TRANSFER_IN` on destination item in the audit ledger.
4. If either warehouse operation fails, the entire transaction is rolled back, preventing orphaned deductions.

---

## 4. Idempotency & Concurrency Strategy

- **Reservation Idempotency**: `inventory_reservations` enforces a unique constraint on `(referenceType, referenceId, inventoryItemId)`. Retrying checkout reservation requests with the same reference ID cannot create duplicate holds.
- **Optimistic Concurrency**: Every inventory item includes a monotonic `version` field incremented upon each stock transition, allowing administrative update conflicts to be detected.
- **Row Locking in Transactions**: High-contention reservation and checkout operations use atomic conditional `UPDATE` statements within transactions, providing database-level concurrency protection without requiring distributed Redis locks.

---

## 5. Integer Quantities Justification

For Larekmart's marketplace and retail merchandise domain, all items are countable, discrete units (products, packages, accessories). PostgreSQL `INTEGER` (and `BIGINT` ready) is used:

- Avoids floating-point rounding errors common with decimals.
- Matches atomic integer increment/decrement semantics.
- For future weight-based or bulk fractional products, a migration to PostgreSQL `NUMERIC(12, 4)` is straightforward without altering the accounting invariants.

---

## 6. Repository API

The package exposes strongly-typed repository modules and re-exports the complete surface from `src/index.ts`:

### Inventory Items (`src/repositories/inventory.repository.ts`)

- `createInventoryItem(input)`: Provision a new warehouse SKU with initial `PURCHASE` movement.
- `getInventoryItem(key)`: Query item by `productId`, `variantId`, `warehouseId`.
- `getInventoryAvailability(lookup)`: Consolidated availability across warehouses for a product.
- `restockInventory(key, quantity, ref?)`: Increment available stock with `RESTOCK` movement.
- `adjustInventory(key, quantityDelta, movementType?, ref?)`: Atomic adjustment with movement logging.
- `transferInventory(input)`: Atomic inter-warehouse transfer with paired ledger entries.
- `listInventoryItems(lookup)`: Query items for a product across warehouses.
- `listAllInventoryItems(filter)`: Admin listing with pagination and status filters.
- `listLowStockInventory(limit)`: Items where `availableQuantity <= reorderPoint`.

### Reservations (`src/repositories/reservation.repository.ts`)

- `reserveInventory(input)`: Atomically reserve stock (enforces available stock check).
- `confirmInventoryReservation(id, userId?, ref?)`: Confirm sale upon payment receipt.
- `confirmReservationsByReference(referenceId, userId?)`: Batch confirmation via checkout session ID.
- `releaseInventoryReservation(id, userId?, ref?)`: Release reservation back to available stock.
- `expireInventoryReservation(id, userId?, ref?)`: Expire reservation.
- `expireStaleReservations(batchSize)`: Sweep and restore all reservations past `expiresAt`.
- `getReservation(id)`: Query reservation with associated item.
- `getActiveReservation(id)`: Query active reservation if not expired.

### Warehouses (`src/repositories/warehouse.repository.ts`)

- `createWarehouse(input)`: Provision a fulfillment facility.
- `getWarehouse(idOrCode)`: Query warehouse by ID or unique code.
- `getWarehouseOrThrow(idOrCode)`: Query warehouse, throwing `WarehouseNotFoundError` if missing.
- `listWarehouses(filter?)`: List warehouses with optional status filter.

### Ledger Movements (`src/repositories/movement.repository.ts`)

- `createMovement(input)`: Record an immutable entry in the audit ledger.
- `listMovements(filter)`: Query audit ledger by product, variant, warehouse, or movement type.
- `listInventoryMovements(key, options)`: Inspect movement history for a specific SKU.

### Domain Errors (`src/errors.ts`)

- `InventoryError` (base class)
- `InventoryNotFoundError`
- `InsufficientStockError`
- `ReservationNotFoundError`
- `ReservationAlreadyConfirmedError`
- `ReservationAlreadyReleasedError`
- `WarehouseNotFoundError`
- `DuplicateReservationError`
- `InvalidInventoryStateError`

---

## 7. Package Structure

```text
packages/inventory-db/
│
├── prisma/
│   ├── schema.prisma                       # Complete PostgreSQL schema
│   └── migrations/
│       └── 00000000000000_init/
│           └── migration.sql               # Production-grade SQL migration with CHECK constraints
│
├── src/
│   ├── client.ts                           # PrismaClient singleton & disconnectPrisma
│   ├── errors.ts                           # Typed domain/database error classes
│   ├── inventory.ts                        # Core transaction & persistence logic
│   ├── index.ts                            # Public package exports
│   │
│   ├── repositories/
│   │   ├── inventory.repository.ts         # Item, restock, transfer & availability
│   │   ├── reservation.repository.ts       # Hold, confirm, release & expiry
│   │   ├── movement.repository.ts          # Movement ledger queries & audit logging
│   │   └── warehouse.repository.ts         # Warehouse facility management
│   │
│   └── scripts/
│       └── verify-inventory-db.ts          # Comprehensive integration test suite
│
├── package.json
├── tsconfig.json
├── README.md
└── .env.example
```

---

## 8. Development & Database Commands

```bash
# Generate Prisma Client
pnpm --filter @repo/inventory-db db:generate

# Apply migrations in development
pnpm --filter @repo/inventory-db db:migrate

# Apply migrations in production
pnpm --filter @repo/inventory-db db:deploy

# Type-check package
pnpm --filter @repo/inventory-db check-types

# Run live database integration verification
pnpm --filter @repo/inventory-db test:integration
```

---

## 9. Environment Configuration

Create `.env` using `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ecommerce?schema=inventory"
```
