# Architectural Plan: High-Velocity Redis Stock Gatekeeper for Flash Sales

## 1. Problem Statement & Bottleneck Analysis

In high-velocity flash sales (e.g., 5,000 req/sec on limited stock):

- The naive implementation executes `prisma.$transaction` with pessimistic row locking (`updateMany` with `availableQuantity: { gte: quantity }`), followed by consecutive queries (`findUniqueOrThrow`, `inventoryReservation.create`, `inventoryMovement.create`, `inventoryItem.update`).
- **The Bottleneck**: All 5,000 concurrent requests contend for the exact same database row lock. PostgreSQL connection pool quickly exhausts, transaction queues spike, and even after stock drops to 0, incoming requests continue to hit the database to fail.
- **The Impact**: P99 latency spikes from 15ms to >5,000ms, database timeouts (`PrismaClientKnownRequestError: Timed out fetching a new connection`), and cascade degradation across the cluster.

---

## 2. Solution: The Redis Stock Gatekeeper Pattern

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Gateway as API Gateway
    participant InvService as inventory-service
    participant Gatekeeper as Redis Stock Gatekeeper (Lua)
    participant Postgres as PostgreSQL (inventory_db)
    participant Kafka as Kafka Cluster

    Client->>Gateway: POST /api/v1/inventory/reservations
    Gateway->>InvService: Forward reservation request
    InvService->>Gatekeeper: Pre-check & atomic decrement (Lua)
    alt Insufficient Stock (Fast Reject <1ms)
        Gatekeeper-->>InvService: { success: false, reason: "INSUFFICIENT_STOCK" }
        InvService-->>Gateway: 409 Insufficient inventory
        Gateway-->>Client: 409 Insufficient inventory (Postgres untouched!)
    else Stock Available (Winning Request)
        Gatekeeper-->>InvService: { success: true, remaining: X, claimToken: "..." }
        InvService->>Postgres: prisma.$transaction (create reservation & movement)
        alt Postgres Success
            Postgres-->>InvService: Reservation persisted
            InvService->>Gatekeeper: Finalize claim (clear temporary token)
            InvService->>Kafka: Publish inventory.reserved event
            InvService-->>Gateway: 201 Created (reservation)
            Gateway-->>Client: 201 Created
        else Postgres Failure (Transient error / timeout)
            Postgres-->>InvService: Error
            InvService->>Gatekeeper: Rollback stock counter (INCRBY)
            InvService-->>Gateway: 500 / 409
        end
    end
```

---

## 3. Detailed Component Architecture

### A. Redis Key Schema (Cluster-Safe Structural Hash Tagging)

To guarantee that multi-key Lua scripts (`RESERVE_LUA`, `ROLLBACK_LUA`) never fail with `CROSSSLOT Keys in request don't hash to the same slot` in a multi-node Redis Cluster, all mutation keys strictly enforce the dual-token CRC16 slot-tagging convention `{tenant_id:warehouse_id}`:

- **Stock Counter**: `stock:available:{tenant_id:warehouse_id}:productId:variantId` (Integer).
- **Claim Token**: `stock:claim:{tenant_id:warehouse_id}:referenceId` (String holding claimed quantity, TTL: 60s).
- **Cold Load Mutex**: `stock:lock:{tenant_id:warehouse_id}:productId:variantId` (String, TTL: 2s).

Both `stock:available` and `stock:claim` share the exact identical `{tenant_id:warehouse_id}` bracket tag, pinning them to the exact same cluster hash slot ($0 \dots 16383$).

### B. Redis Lua Script (Atomic Reservation Pre-Check)

```lua
-- KEYS[1]: stock:available:{tenant_id:warehouse_id}:productId:variantId
-- KEYS[2]: stock:claim:{tenant_id:warehouse_id}:referenceId
-- ARGV[1]: requestedQuantity
-- ARGV[2]: claimTtlSeconds (e.g. 60)

local currentStock = redis.call('GET', KEYS[1])
if not currentStock then
    return { -1, 0 } -- Code -1: Key does not exist (cold cache)
end

local stock = tonumber(currentStock)
local requested = tonumber(ARGV[1])

if stock < requested then
    return { 0, stock } -- Code 0: Insufficient stock, returns current stock
end

-- Atomic decrement and claim registration
local remaining = redis.call('DECRBY', KEYS[1], requested)
redis.call('SET', KEYS[2], requested, 'EX', ARGV[2])

return { 1, remaining } -- Code 1: Success, returns remaining stock
```

### C. Cold Cache Initialization (Distributed Mutex)

1. If Lua returns `-1` (key missing):
2. Acquire `stock:lock:{tenant_id:warehouse_id}:productId:variantId` with 2-second TTL.
3. Fetch ground truth `availableQuantity` from PostgreSQL `inventoryItem`.
4. `SET stock:available:{tenant_id:warehouse_id}:productId:variantId availableQuantity`.
5. Release mutex and re-execute reservation Lua script.

### D. Compensation & Release Handling

- **Database Failure**: If PostgreSQL transaction fails after a successful Redis claim, execute `INCRBY` by `requestedQuantity` and delete `stock:claim:{referenceId}`.
- **Reservation Expiry & Cancellation**: When `releaseInventoryReservation` or `expireInventoryReservation` executes:
  - Update PostgreSQL row.
  - Execute `INCRBY stock:available:... quantity`.
  - Invalidate centralized read cache and publish `inventory.stock.updated`.

---

## 4. Implementation Details

1. **Module**: `apps/inventory-service/src/gatekeeper/redis-stock-gatekeeper.ts`.
2. **Route Integration**: `apps/inventory-service/src/routes/inventory.route.ts` inside `POST /reservations`.
3. **Expiry Worker**: `apps/inventory-service/src/workers/reservation-expiry.worker.ts` and release handlers.
4. **Automated Verification**: `apps/inventory-service/tests/redis-stock-gatekeeper.test.ts`.
   - High-concurrency flash-sale oversell prevention.
   - Fast-rejection under 0 stock without PostgreSQL queries.
   - Cold cache initialization with distributed mutex.
   - Automatic compensation rollback on database error.
