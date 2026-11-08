# Flash-Sale Hyperscale Bottlenecks Remediation Plan (50,000+ RPS)

**Date:** 2026-11-09  
**Target:** Larekmart Production Microservices Architecture (11.11 / Black Friday Flash-Sale Scale)  
**Status:** Fully Implemented & Verified Architectural Blueprint  
**Scope:** `cart-service`, `packages/kafka`, Database Configuration & Connection Strings, Redis Topology

---

## Executive Summary

During our deep architectural evaluation under extreme flash-sale concurrency (**50,000+ RPS burst**, hot SKU contention, payment webhook spikes, and thundering herd traffic), we identified **four critical structural bottlenecks** across Larekmart's microservice ecosystem that threaten system availability, consumer throughput, and transaction integrity.

Through the collaborative `/grill-me` design alignment, the following four critical bottlenecks were identified and slated for remediation:

1. **Inter-Service Synchronous HTTP Coupling in Cart Operations**: `cart-service` executes synchronous HTTP calls (`fetch`) to `product-service` (`:8000`) and `inventory-service` (`:8007`) during add-to-cart mutations, violating core architectural Principle 3 ("Asynchronous integration; no service-to-service HTTP calls") and creating cascading failure loops under burst traffic.
2. **PostgreSQL Connection Pool Exhaustion & PgBouncer Bypass**: Multiple microservices and database packages (`product-service`, `inventory-service`, `seller-service`, `packages/product-db`, etc.) connect directly to PostgreSQL on port `5432` rather than PgBouncer (`:6432`). Horizontal pod scaling under load risks exceeding PostgreSQL's `max_connections` (100).
3. **Kafka Topic Partitioning Ceiling**: Core event topics are initialized with a hardcoded `numPartitions: 3`, capping consumer group parallelism to at most 3 worker instances per topic and triggering massive consumer lag during flash-sale spikes.
4. **Single-Node Redis Saturation & Eviction Contention**: High-frequency volatile read caches (`catalog:v1:*`, `product:v1:*`) and critical financial/inventory state (`stock:available:*`, idempotency locks) share a single standalone Redis node, creating CPU saturation and risk of cache eviction wiping out stock counters.

---

## 1. Deep Dive: Bottleneck Breakdown & Failure Modes

```mermaid
flowchart TD
    subgraph Bottleneck1["1. In-Band Cart HTTP Coupling"]
        C1[Client / Gateway] -->|POST /api/v1/cart/items| CS1[cart-service]
        CS1 -->|Sync HTTP 50-300ms| PS1[product-service :8000]
        CS1 -->|Sync HTTP 50-200ms| IS1[inventory-service :8007]
        PS1 -.->|Timeout / Pool Starvation| F1[Cascading 504 Gateway Timeouts]
    end

    subgraph Bottleneck2["2. Postgres Connection Starvation"]
        R2[Scaled Microservice Pods] -->|Direct :5432 Prisma Pools| PG2[Postgres max_connections=100]
        PG2 -->|Connection Pool Starvation| E2["FATAL: remaining connection slots reserved"]
    end

    subgraph Bottleneck3["3. Kafka Partition Parallelism Cap"]
        KP3[Producer 50k RPS] -->|3 Partitions Only| T3[Topic: order.created / payment.successful]
        T3 -->|Max 3 Active Consumers| W3[3 Pods Working, 7 Idle Pods]
        W3 -->|Consumer Lag Accumulation| L3[Order Confirmation & Ingestion Delay]
    end

    subgraph Bottleneck4["4. Redis Shared Instance Contention"]
        CR4[High-Volume Read Caches] & LK4[Flash-Sale Stock Gatekeeper] --> RD4[Single Redis Node]
        RD4 -->|Memory Pressure| EV4[Cache Eviction drops Stock Claim / Idempotency Key]
        EV4 -->|Overselling Risk| OV4[Inventory Discrepancy / Oversell]
    end
```

---

## 2. The 4-Pillar Architectural Remediation Solution

### Pillar 1: Asynchronous Event-Driven Cart Decoupling

#### Problem
In `apps/cart-service/src/services/validation.service.ts`:
- `validateProduct(productId)` performs a synchronous HTTP `fetch` to `${env.PRODUCT_SERVICE_URL}/products/${productId}`.
- `checkInventoryAvailability(...)` falls back to `${env.INVENTORY_SERVICE_URL}/api/v1/inventory/${productId}/availability` on cache miss.

Under 50k RPS, cart traffic creates massive synchronous load on downstream services, saturating their HTTP thread pools and causing cascading timeouts.

#### Remediation Architecture
1. **Local Product Read Model in Cart Service**:
   - `cart-service` already consumes `product.updated` and `product.deleted` via `apps/cart-service/src/consumers/product.consumer.ts`.
   - Extend the consumer to maintain a lightweight local MongoDB collection (`ProductSnapshot`) or Redis key (`cart:product:meta:{productId}`) containing `{ name, price, image, isActive, updatedAt }`.
   - `validateProduct()` resolves from this local read model in **<1ms**, eliminating the HTTP dependency entirely.
2. **Pure Redis Stock Availability Check**:
   - Read directly from the centralized Redis stock cache (`stock:available:{tag}:{productId}`).
   - Eliminate the HTTP fallback: if stock key is missing during an add-to-cart operation, treat as optimistically available (or check local snapshot). Strict reservation and hard inventory leases are guaranteed at checkout via `inventory-service`'s `RedisStockGatekeeper` and micro-batch reservation worker.

```mermaid
sequenceDiagram
    autonumber
    participant Client as Storefront Client
    participant GW as API Gateway
    participant Cart as Cart Service
    participant Redis as Redis Stock Cache
    participant DB as Cart MongoDB
    participant Kafka as Kafka Event Stream

    Kafka->>Cart: product.created / product.updated
    Cart->>DB: Upsert ProductSnapshot (local read-model)
    Client->>GW: POST /api/v1/cart/items
    GW->>Cart: Forward AddToCart
    Cart->>DB: Query ProductSnapshot (<1ms)
    Cart->>Redis: Check stock counter (<0.5ms)
    Cart->>DB: Upsert Cart Document
    Cart-->>GW: Return Updated Cart (No HTTP calls to external services)
```

---

### Pillar 2: Universal PgBouncer Connection Pool Architecture

#### Problem
Multiple backend services connect directly to PostgreSQL on port `5432`. Each Node.js microservice replica instantiates a Prisma Client connection pool (typically 5 to 10 connections per pod). When horizontal pod autoscaling (HPA) scales 13 relational services to 5-10 pods each, connection demand reaches:
$$\text{Total Connections} = 13 \text{ services} \times 10 \text{ pods} \times 10 \text{ pool} = 1,300 \text{ connections}$$
This rapidly exceeds PostgreSQL's default `max_connections` (100–200), resulting in `FATAL: remaining connection slots are reserved for non-replication superuser connections`.

#### Remediation Architecture
Standardize all relational services and packages to follow the **Dual-URL Connection Pattern**:

1. **Runtime Connection (`DATABASE_URL`)**:
   - Points to PgBouncer on port `6432`.
   - Transaction pooling mode:
     ```env
     DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@pgbouncer:6432/larekmart_<service>_db?schema=public&pgbouncer=true&statement_cache_size=0
     ```
   - Disables prepared statement caching to prevent cross-transaction collision in PgBouncer.
2. **Migration Connection (`DIRECT_URL`)**:
   - Points directly to PostgreSQL on port `5432`.
   - Used solely during CI/CD build steps (`prisma migrate deploy`, `prisma db push`) that require session-level locking and DDL execution.
3. **Services to Standardize**:
   - `packages/product-db`
   - `packages/inventory-db`
   - `packages/vendor-db`
   - `packages/shipping-db`
   - `packages/catalog-db`
   - `packages/user-db`
   - `packages/support-db`
   - `apps/product-service`
   - `apps/inventory-service`
   - `apps/seller-service`
   - `apps/tax-service`
   - `apps/pricing-service`
   - `apps/commission-service`

---

### Pillar 3: Tiered Kafka Topic Partitioning & Parallelism Scaling

#### Problem
In `packages/kafka/src/init-topics.ts`, topic creation defines:
```ts
numPartitions: 3,
replicationFactor: 1
```
In Kafka, a partition within a topic can only be consumed by **one** consumer instance within a consumer group at any given time. With 3 partitions, spinning up 10 replicas of `inventory-service` or `order-service` results in **7 completely idle pods**. Under 50,000 RPS, messages accumulate rapidly in the 3 partitions, leading to fatal consumer lag and delayed order confirmations.

#### Remediation Architecture
Implement a **Tiered Partitioning Strategy** based on topic velocity and transaction criticality:

| Topic Tier | Topics | Partitions | Justification |
| :--- | :--- | :--- | :--- |
| **Tier 1: Hyperscale Transactional & Sagas** | `order.created`, `payment.successful`, `inventory.reservation.requested`, `inventory.stock.sold`, `order.completed` | **16 partitions** | Allows scaling up to 16 parallel Saga consumer workers. Deterministic partition keys (`orderId`, `productId`) preserve strict causal ordering. |
| **Tier 2: High-Velocity Telemetry & Behavior** | `product.viewed`, `product.added_to_cart`, `product.searched`, `recommendation.interaction` | **16 partitions** | Absorbs massive storefront clickstream bursts directly into `analytic-service` without backpressure. |
| **Tier 3: Standard Operational & Catalog** | `product.created`, `product.updated`, `cart.*`, `wishlist.*`, `review.*` | **8 partitions** | Balanced parallelism for catalog changes and cart sync events. |
| **Tier 4: Low-Velocity Administrative** | `category.*`, `vendor.*`, `tax.*`, `commission.*`, `user.*` | **3 to 4 partitions** | Minimal overhead for low-frequency administrative workflows. |

**Configuration Control**:
Support dynamic partition overrides via `KAFKA_DEFAULT_NUM_PARTITIONS` and `KAFKA_TIER1_NUM_PARTITIONS` environment variables to allow local development with 3 partitions and production deployment with 16–32 partitions.

---

### Pillar 4: Dual-Redis Topology: State vs Cache Separation

#### Problem
Larekmart currently directs all Redis traffic to a single standalone instance (`redis:6379`). During flash sales:
- Heavy catalog read caches (`catalog:v1:*`, `product:v1:*`) and API rate limits share memory with `RedisStockGatekeeper` atomic counters (`stock:available:*`) and idempotency locks.
- If Redis reaches memory limits or undergoes heavy read evictions under `allkeys-lru`, critical inventory stock keys or unexpired idempotency locks can be evicted, triggering **overselling** or **duplicate order execution**.
- Single-threaded Redis event loop becomes a CPU bottleneck under mixed Lua script execution and bulk cache invalidation.

#### Remediation Architecture
Split Redis into two dedicated logical/physical instances:

```mermaid
flowchart LR
    subgraph Clients["Application Workspaces"]
        GW[API Gateway]
        IS[inventory-service]
        OS[order-service]
        CS[catalog-service]
        PS[product-service]
    end

    subgraph StateRedis["1. State Redis (:6380 / REDIS_STATE_URL)"]
        direction TB
        S1[stock:available:...]
        S2[stock:claim:...]
        S3[idempotency:lock:...]
        S4[saga:state:...]
        P1["maxmemory-policy: noeviction"]
    end

    subgraph CacheRedis["2. Cache Redis (:6379 / REDIS_CACHE_URL)"]
        direction TB
        C1[catalog:v1:...]
        C2[product:v1:...]
        C3[rate-limit:ip:...]
        C4[search:autocomplete:...]
        P2["maxmemory-policy: allkeys-lru"]
    end

    IS & OS -->|Atomic Decrements & Locks| StateRedis
    GW & CS & PS -->|Rate Limits & Read Caches| CacheRedis
```

1. **State Redis (`REDIS_STATE_URL`, default port `6380`)**:
   - Dedicated solely to: `stock:available:*`, `stock:claim:*`, `idempotency:*`, distributed Saga locks.
   - Configured with `maxmemory-policy noeviction` (guarantees that inventory and financial state can never be silently evicted).
   - High-persistence RDB + AOF (`appendfsync everysec`).
2. **Cache Redis (`REDIS_CACHE_URL` / `REDIS_URL`, default port `6379`)**:
   - Dedicated to: API Gateway rate limits, singleflight cache buffers, catalog and product read caches, search queries.
   - Configured with `maxmemory-policy allkeys-lru`.
   - Volatile, performance-tuned memory pool.

---

## 3. Implementation Blueprint & File Changes

| Component / File | Change Scope | Pillar |
| :--- | :--- | :--- |
| `apps/cart-service/src/services/validation.service.ts` | Eliminate HTTP `fetch` to `product-service` and `inventory-service`. Replace with local snapshot lookup and Redis stock read. | Pillar 1 |
| `apps/cart-service/src/consumers/product.consumer.ts` | Upsert incoming `product.created` and `product.updated` into local `ProductSnapshot` MongoDB model. | Pillar 1 |
| `apps/cart-service/src/models/product-snapshot.model.ts` | Create Mongoose schema for local product read-model (ID, name, price, image, isActive). | Pillar 1 |
| `packages/kafka/src/init-topics.ts` | Implement `TIERED_TOPIC_CONFIG` mapping topics to 16, 8, or 4 partitions with environment variable overrides. | Pillar 3 |
| `packages/*-db/.env.example`, `apps/*/.env.example` | Update default `DATABASE_URL` to route through port `6432` with `pgbouncer=true&statement_cache_size=0`; add `DIRECT_URL` on port `5432`. | Pillar 2 |
| `docker-compose.yml` | Add `redis-state` container (:6380) alongside `redis` (:6379); configure PgBouncer port mapping and environment variables. | Pillar 4 |
| `packages/redis/src/client.ts` | Add support for dual-connection factory: `createStateRedisClient()` and `createCacheRedisClient()`. | Pillar 4 |

---

## 4. Verification and Chaos Hardening Matrix

| Test Suite | Target | Success Criteria |
| :--- | :--- | :--- |
| **Cart Autonomous Disconnect Test** | Stop `product-service` and `inventory-service` containers. Execute 1,000 add-to-cart requests. | 100% success rate with zero 504 gateway timeouts; all items validated via local snapshot and Redis counters. |
| **PgBouncer Concurrency Flood** | Spin up 50 simulated client connections across all 13 services simultaneously executing transactions. | Zero connection starvation errors; PostgreSQL backend connection count stays stably $\le 20$. |
| **Kafka High-Throughput Consumer Scaling** | Produce 50,000 messages to `order.created` with 16 partitions; spin up 8 consumer instances. | Load distributes evenly across all 8 consumer instances; consumer lag resolves in $<5$ seconds. |
| **Redis Eviction & Oversell Stress Test** | Flood Cache Redis with 100,000 oversized cache keys while executing 5,000 concurrent stock claims on State Redis. | Zero eviction of stock keys or claim tokens; zero oversell occurrences. |

---

## 5. Implementation & Verification Record

All 4 hardened pillars have been implemented and verified with zero TypeScript compilation errors and 100% test pass rates:

- [x] **Pillar 1 (Cart Service Decoupling)**: Local `ProductSnapshot` schema created in `@repo/cart-db`, event consumers wired in `cart-service`, synchronous HTTP `fetch` calls replaced with local snapshot + Redis reads in `validation.service.ts`, verified by `apps/cart-service/tests/validation.test.ts`.
- [x] **Pillar 2 (Universal PgBouncer Routing)**: `docker/pgbouncer/pgbouncer.ini` configured with dedicated pools (`support_db`, `chat_db`, `fraud_db`), `docker-compose.yml` updated to route `DATABASE_URL` via port `6432`, and `.env.example` templates standardized across all 7 database packages and services.
- [x] **Pillar 3 (Tiered Kafka Partitioning)**: Tiered partitioning logic implemented in `packages/kafka/src/init-topics.ts` (16 partitions for Tier 1 transaction/sagas & Tier 2 clickstream telemetry; 8 partitions for Tier 3 operational topics; 4 partitions for Tier 4 admin topics) with environment variable overrides, verified by `packages/kafka/tests/partitioning.test.ts`.
- [x] **Pillar 4 (Dual-Redis Topology)**: `createStateRedisService` and `createCacheRedisService` added to `@repo/redis`, `redis-state` container (:6380) configured with `noeviction` in `docker-compose.yml`, and `inventory-service`, `order-service`, and `api-gateway` updated to route state vs cache traffic independently.
