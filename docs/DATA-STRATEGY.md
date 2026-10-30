# Data Strategy Document — Larekmart E-Commerce Platform

## 1. Data Architecture Principles

1. **Database-per-Service Paradigm**: Each microservice strictly owns its operational database. Direct cross-database queries or shared connections between services are strictly prohibited.
2. **Polyglot Persistence**: The data store is selected based on the domain's operational and query characteristics:
   - **PostgreSQL (Relational)**: Structured catalog, relational constraints, foreign keys, and analytical audit logs.
   - **MongoDB (Document)**: Highly nested, schema-flexible order histories, customer addresses, and line-item snapshots.
   - **Kafka (Streaming)**: Distributed immutable event commit log for asynchronous cross-service choreography.
3. **Eventual Consistency**: State synchronization across services is achieved through Kafka event streams with idempotent consumer handlers.

---

## 2. Bounded Contexts & Data Ownership

| Bounded Context        | Owning Microservice     | Storage Engine   | Access Layer                | Data Lifecycle                                                  |
| :--------------------- | :---------------------- | :--------------- | :-------------------------- | :-------------------------------------------------------------- |
| **Catalog & Products** | `apps/product-service`  | PostgreSQL       | `@repo/product-db` (Prisma) | CRUD with transactional ACID guarantees                         |
| **Orders & Sales**     | `apps/order-service`    | MongoDB          | `@repo/order-db` (Mongoose) | Append-mostly with high write throughput                        |
| **Checkout & Billing** | `apps/payment-service`  | Stripe Vault     | `stripe` Node SDK           | Tokenized sessions with PCI-DSS compliance                      |
| **User Identity**      | `apps/auth-service`     | Clerk Identity   | `@clerk/express` SDK        | Managed user store with JWT session claims                      |
| **Transactional Mail** | `apps/email-service`    | Ephemeral        | Nodemailer / OAuth2         | In-memory message consumption                                   |
| **Platform Analytics** | `apps/analytic-service` | PostgreSQL / Mem | `pgxpool` (`jackc/pgx/v5`)  | Partitioned binary COPY audit logs + atomic in-memory KPI store |

---

## 3. Event Streaming & Consistency Guarantees

```
[Producer Service] ───(JSON { value: payload })───▶ [Kafka Broker]
                                                           │
                      ┌────────────────────────────────────┴────────────────────────────────────┐
                      ▼                                                                         ▼
           [Consumer Service 1]                                                      [Consumer Service 2]
         (Handler: message.value)                                                  (Handler: message.value)
```

- **Serialization**: JSON-encoded payload enveloped under `{ value: <data> }`.
- **Partitioning & Ordering**: Topic-level ordering guaranteed per key.
- **Consumer Offsets**: Managed via Kafka Consumer Groups (`fromBeginning: true` for state recovery).
- **At-Least-Once Delivery**: Handlers must be idempotent to tolerate duplicate event consumption or historical replays.

---

## 4. Data Security, Privacy & Compliance

- **PII Protection**: Sensitive customer credentials, passwords, and payment card numbers are never stored in internal databases.
- **Encryption in Transit**: All external API traffic requires TLS 1.3; database connections use SSL in production.
- **Encryption at Rest**: PostgreSQL tables and MongoDB collections use AES-256 transparent data encryption (TDE).
- **Sanitization in Logs**: No raw auth tokens, secret keys, or credit card numbers are logged to stdout/stderr.

---

## 5. PostgreSQL Read-Replicas & PgBouncer Connection Topology

To sustain high read-to-write ratios during flash sales without saturating the primary transactional database, Larekmart separates operational write traffic from read projections:

```
[Storefront Browsing / Read Projections]          [Kafka Projectors / Catalog Writers]
                  │                                                 │
                  ▼                                                 ▼
       `catalog-service (readPrisma)`                    `catalog-service (prisma)`
                  │                                                 │
                  ▼                                                 ▼
      [PgBouncer: catalog_db_replica]                    [PgBouncer: catalog_db]
          (host=postgres-replica)                           (host=postgres)
                  │                                                 │
                  ▼                                                 ▼
     [PostgreSQL Read Replica (Hot Standby)] ◀───(WAL Stream)─── [PostgreSQL Primary Writer]
```

### Read-Write Client Separation & Read-Your-Writes Consistency (`@repo/catalog-db`)

- **`readPrisma`**: Connected to `DATABASE_READ_REPLICA_URL` (or PgBouncer `catalog_db_replica` pool on port 6432). Used by default for high-volume storefront browsing queries (`catalog.repository`, `category.repository`, `brand.repository`, `collection.repository`) to offload primary writers.
- **`prisma`**: Connected to `DATABASE_URL` (primary writer pool `catalog_db`). Used exclusively by asynchronous Kafka projection consumers (`product-projector.ts`, `category-projector.ts`, `collection-projector.ts`) to persist updates from the write plane.
- **`getCatalogDb(forcePrimary?: boolean)`**: Dynamically selects between `prisma` and `readPrisma`. When a mutating request arrives, API gateway registers a 500ms Read-Your-Writes lease in Redis (`markReadYourWrites`) and injects `x-force-primary: true`. Downstream, `catalog-service` detects the lease via `databaseContext`, bypasses stale Redis read caches, and queries `prisma` directly until replication log lag catches up.
- **Fail-Open Fallback**: If `DATABASE_READ_REPLICA_URL` is unset, `readPrisma` seamlessly falls back to the primary `prisma` instance with zero configuration changes.

---

## 6. MongoDB Orders Horizontal Sharding & Storage I/O Rules

To prevent single-instance storage I/O and RAM bottlenecks as order history expands, `apps/order-service` implements native horizontal collection sharding:

```
                                [Fastify Order Service Array]
                                              │
                                              ▼ (readPreference=secondaryPreferred)
                                       [mongos Router]
                                       (Port: 27017)
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
               [Shard Cluster 1]       [Shard Cluster 2]       [Shard Cluster 3]
               Chunks: Hash 0..33%     Chunks: Hash 34..66%    Chunks: Hash 67..100%
```

### 1. Hashed Shard Key: `{ userId: "hashed" }`

- **Uniform Distribution**: Order documents are partitioned using a 64-bit MD5-hashed index on `userId`. This ensures incoming writes during flash sales are uniformly spread across all shard nodes rather than creating monotonic insertion bottlenecks (which occur when sharding on monotonically increasing timestamps or ObjectIds).
- **Targeted Single-Shard Routing**: Customer order history queries (`GET /user-orders`) supply `userId`, enabling the `mongos` router to route queries directly to the specific shard containing that user's chunks—bypassing cross-shard broadcast overhead.

### 2. Scatter-Gather Query Mitigation

Queries that do not contain `userId` naturally broadcast across all shards. To ensure these operations remain sub-millisecond, targeted compound indexes are maintained:

- **Marketplace Seller Queries (`GET /seller-orders`)**:
  - `OrderSchema.index({ sellerId: 1, createdAt: -1 }, { sparse: true })`
  - `OrderSchema.index({ "products.sellerId": 1, createdAt: -1 }, { sparse: true })`
- **Checkout Saga Timeout Sweeper**:
  - `OrderSchema.index({ status: 1, createdAt: -1 })`
- **Stripe Webhook Idempotency**:
  - `OrderSchema.index({ paymentSessionId: 1 }, { sparse: true })`

### 3. Connection Pool Configuration

- `maxPoolSize`: 100 concurrent sockets per container replica.
- `minPoolSize`: 10 pre-warmed sockets to eliminate cold-start handshake latency.
- `readPreference`: `secondaryPreferred` to offload analytical and read-heavy queries from primary shard nodes.
- **Graceful Fallback**: `ensureOrderCollectionSharded()` probes `isMaster.msg === "isdbgrid"` to automatically shard collections when running on a sharded cluster, and degrades gracefully in local single-node development environments.

---

## 7. Redis Cluster Sharding & Distributed Concurrency Guardrails

### 1. Deterministic Hash Tag Structural Convention

Multi-key Lua scripts executed on Redis Cluster require all evaluated keys to hash to the exact same hash slot (0 to 16,383) to avoid `CROSSSLOT` exceptions. Larekmart enforces a multi-tenant hash tag pattern:

$$\text{Key Pattern: } \texttt{stock:available:\{tenant\_id:warehouse\_id\}:productId:variantId}$$

Example: `stock:available:{pk_khi_01}:prod_9981:var_002`  
Redis evaluates the CRC16 slot solely on `{pk_khi_01}`, pinning all inventory operations for that distribution center to a single shard.

### 2. Distributed Leader Election & Worker Isolation

Background maintenance routines (outbox sweepers, saga timeout workers, cart reap routines, inventory reservation sweepers) utilize `DistributedLeaderElector` and `withClusterLock`:

- **Leader Lease Heartbeats**: Active leader renews its lease every 3,000ms (10,000ms TTL).
- **Standby Follower Replicas**: Standby containers remain in hot standby mode with zero database cursor overhead and zero duplicate Kafka dispatches.
- **Automated Failover**: Standby replicas detect vacancy within 2,000ms upon leader termination and promote themselves seamlessly.
