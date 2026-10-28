# Architecture Specification: Zero-Downtime OpenSearch Index Aliasing & Drift Reconciliation

## 1. Executive Summary & Problem Analysis

In a 23-microservice e-commerce ecosystem operating at Daraz scale:
- **Current Limitation**: OpenSearch reindexing originally ran synchronously via HTTP (`wait_for_completion: true`). During large-catalog migrations or schema changes, this caused Fastify API gateway proxy timeouts (5–10s) and severed client connections.
- **The Data Loss Drift Problem**: While OpenSearch's native `_reindex` copied documents from `products-v1` to `products-v2` (taking anywhere from seconds to several minutes), in-flight mutations (`product.created`, `product.updated`, `inventory.stock.sold`, `price.updated`, and admin HTTP updates) only updated `products-v1`. Once the alias swapped to `products-v2`, all mutations that occurred during the copy window were permanently lost.
- **Lack of Verification & Instant Rollback**: Blindly swapping aliases without pre-swap document parity checks could expose storefront users to missing or corrupt product catalogs, with no automated rollback mechanism.

To solve this, this subsystem implements **Zero-Downtime Blue/Green OpenSearch Aliasing with Live Drift Reconciliation, Verification Gates, and 1-Click Rollback**.

---

## 2. Core Architecture & Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant SearchAPI as search-service (Reindex Engine)
    participant Reconciler as DriftReconciler
    participant OS as OpenSearch Cluster (v1 -> v2)
    participant Kafka as Kafka Consumers

    Admin->>SearchAPI: POST /api/v1/index/reindex?async=true
    SearchAPI->>OS: Create new versioned index (products-v{timestamp})
    SearchAPI->>Reconciler: Register active target index (products-v{timestamp})
    SearchAPI-->>Admin: 202 Accepted (jobId, targetIndex)

    par Background Copy & Active Traffic
        SearchAPI->>OS: Execute _reindex from products-v1 to products-v2
        Note over Kafka,Reconciler: Live In-Flight Mutations (Kafka & HTTP)
        Kafka->>SearchAPI: product.updated / stock.sold
        SearchAPI->>OS: Index into active alias (products-v1)
        SearchAPI->>Reconciler: Dual-write / journal mutation to products-v2
    end

    SearchAPI->>Reconciler: Copy complete; Drain & flush buffered drift mutations
    SearchAPI->>OS: Pre-swap verification gate (count parity, sample match_all query)
    alt Parity Check Passes
        SearchAPI->>OS: Atomic alias swap (remove alias from v1, add to v2)
        SearchAPI->>SearchAPI: Retain v1 as historical snapshot for rollback
        SearchAPI->>SearchAPI: Invalidate Redis search cache namespace
        SearchAPI->>SearchAPI: Mark job COMPLETED
    else Parity Check Fails
        SearchAPI->>SearchAPI: Abort alias swap; Retain v1 as active
        SearchAPI->>SearchAPI: Mark job FAILED (parity failure reason)
    end
    SearchAPI->>Reconciler: Unregister target index
```

---

## 3. Subsystem Components

### A. `@repo/opensearch` Enhancements
- **Atomic Alias Swap (`atomicAliasSwap`)**:
  Performs an atomic `updateAliases` transaction in OpenSearch, removing the alias from old indices and binding it to the new index in a single network round-trip.
- **Index Parity Verification (`verifyIndexParity`)**:
  Compares source and target document counts with a configurable tolerance delta (default 5%) and tests a sample `match_all` query against the target index before allowing the swap.
- **Alias Topology Query (`getAliasTopology`)**:
  Scans all versioned indices (`products-v*`) to determine the current active pointer and retained historical snapshots.

### B. `apps/search-service`: Drift Reconciliation Engine (`DriftReconciler`)
- **Live Dual-Writing**:
  When a reindex job is active, `indexingService.indexOrUpdateProduct`, `updateProductPartial`, and `deleteProduct` replicate mutations to the pending target index with optimistic concurrency control.
- **Offline Drift Journal Buffer**:
  If a direct dual-write fails (e.g. transient cluster throttling during heavy reindexing scroll), the mutation is buffered in an in-memory drift journal and drained immediately upon reindex completion.

### C. Asynchronous Job Manager & Rollback API
- `POST /api/v1/index/reindex`: Supports asynchronous processing (`?async=true` or `Prefer: respond-async`) returning `202 Accepted` with a tracking `jobId`.
- `GET /api/v1/index/reindex/:jobId`: Returns current job phase (`INITIALIZING`, `COPYING_DOCUMENTS`, `RECONCILING_DRIFT`, `SWAPPING_ALIAS`, `COMPLETED`, `FAILED`).
- `GET /api/v1/index/alias`: Returns current alias topology and retained previous indices.
- `POST /api/v1/index/alias/rollback`: Instantaneously rolls back the alias to any previous versioned index without downtime.

---

## 4. Verification & Testing

Validated with automated test suites (`apps/search-service/tests/unit/reindex-drift-reconciliation.test.ts`):
1. **DriftReconciler Dual-Write & Buffer Draining**:
   Simulated mutations during active reindexing; verified live replication and fallback journal drain.
2. **Index Parity Gate**:
   Verified that acceptable count differences within delta tolerance pass, while severe count deltas abort the swap before exposing corrupt indices.
3. **Rollback & Contract Validation**:
   Verified `RollbackRequestSchema` and `AliasTopologyResponse` contracts.
