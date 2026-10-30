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

## Concurrency, Redis Gatekeeper, and Events

- **Flash-Sale Redis Stock Gatekeeper (`src/gatekeeper/redis-stock-gatekeeper.ts`)**:
  - High-velocity checkout traffic is pre-checked via an atomic Redis Lua script (`RESERVE_LUA`) before reaching PostgreSQL.
  - Insufficient stock requests are fast-rejected in <1ms without touching the database, protecting PostgreSQL connection pools from row-lock starvation.
  - Winning requests claim stock in Redis, acquire a temporary claim token (`stock:claim:{referenceId}` with 60s TTL), and proceed to PostgreSQL to persist the formal reservation and movement ledger.
  - If PostgreSQL transaction fails, the Redis counter is immediately rolled back (`ROLLBACK_LUA`) to prevent stock leakage.
  - Cold cache misses are lazily populated from PostgreSQL using a 2-second distributed mutex (`stock:lock:...`) to prevent thundering herds.
  - Released or expired reservations atomically increment the Redis stock counter (`INCREMENT_LUA`).
  - **Cluster Hash-Tagging Invariant**: All multi-key operations and Lua evaluations MUST pin dependent keys to the same CRC16 slot using `{tenant_id:warehouse_id}` brackets. Assert slot alignment via `assertClusterSlotAlignment` before evaluating Lua logic to prevent fatal `CROSSSLOT` failures on clustered deployments.
- Use `@repo/inventory-db` operations; never read a quantity and then write an unconditional replacement.
- Reservations use a conditional atomic update requiring sufficient available stock.
- Publish `inventory.*` Kafka events only after the database transaction commits. Event publication is observable but does not make Redis or Kafka authoritative.
- Use `{ value: payload }` when publishing and keep handlers/event consumers defensive.

## Security

- Clerk is the only authentication system.
- Derive `userId` from verified Clerk claims. Never accept a client-supplied user ID.
- Admin-only stock setup and adjustment routes use `shouldBeAdmin`.
- Reservation transitions use the authenticated reservation owner.

## Verification

```bash
pnpm --filter inventory-service check-types
pnpm --filter inventory-service test
pnpm --filter inventory-service build
pnpm --filter @repo/inventory-db db:generate
```

A running PostgreSQL and Redis are required for live service verification. Automated test suites run via `pnpm --filter inventory-service test` covering Stripe verification, auth guards, Zod schemas, and Redis Stock Gatekeeper concurrency and stress tests.
