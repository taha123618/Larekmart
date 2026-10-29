# Order Service (`apps/order-service`)

Authoritative order lifecycle authority, Multi-DB Checkout Saga orchestrator, transactional outbox relay, and order analytics microservice for **Larekmart**.

---

## 1. Tech Stack & Architecture

- **Framework**: Fastify 5 + TypeScript (ESM)
- **Database**: MongoDB via Mongoose (`@repo/order-db`)
  - **Horizontal Sharding**: Hashed shard key on `{ userId: "hashed" }` distributing orders across MongoDB shards.
  - **Scatter-Gather Mitigation Indexes**: Targeted compound indexes on `{ sellerId: 1, createdAt: -1 }`, `{ "products.sellerId": 1, createdAt: -1 }`, and `{ status: 1, createdAt: -1 }`.
- **Messaging**: Apache Kafka (`@repo/kafka`)
- **Cache & Distributed Consensus**: Redis (`@repo/redis`)
  - **Distributed Leader Election**: Coordinates single-active outbox sweeper execution across clustered replicas (`order:outbox:sweeper:leader`).
  - **Distributed Idempotency Engine**: Atomic Redis leases preventing duplicate order writes on `POST /orders/cod`.
  - **Read-Through Cache**: TTL-bounded cache for `GET /order-chart` (`order:v1:*`).
- **Auth**: Clerk (`@clerk/fastify`)
- **Port**: `8001`

---

## 2. High-Concurrency Distributed Patterns

### Multi-DB Dual-ACK Checkout Saga
When a customer payment completes, three distinct database engines achieve eventual consistency without blocking 2PC locks:
1. `order-service` consumes `payment.successful`, persists the order in `pending_confirmation`, and emits `order.created`.
2. `order-service` awaits **Dual-ACK**:
   - `inventory.stock.sold` (emitted by `inventory-service` from PostgreSQL)
   - `tax.calculation.completed` (emitted by `tax-service` from MySQL)
3. Once both ACKs arrive, the order transitions to `confirmed` and publishes `order.confirmed`.
4. If either ACK fails (e.g., `inventory.reservation.failed` or `tax.calculation.failed`), the saga automatically triggers compensating transactions:
   - Emits `inventory.reservation.cancelled` (releases reserved stock)
   - Emits `payment.refund.requested` (triggers automated Stripe refund in `payment-service`)
   - Emits `tax.calculation.voided` (reverses tax journal in `tax-service`)
   - Transitions order status to `cancelled`

### Transactional Outbox Relay with Distributed Leader Election
- State-mutating transactions write domain events to MongoDB's `OutboxEvent` collection inside the same ACID transaction session as the `Order` mutation.
- **Distributed Leader Election (`DistributedLeaderElector`)**:
  - Horizontal scaling of `order-service` replicas (e.g. 3–25 pods via HPA) could lead to concurrent outbox sweeps and duplicate Kafka dispatches.
  - All replica instances participate in Redis leader election on key `order:outbox:sweeper:leader`.
  - Only the elected **Leader** executes the 5-second background sweeper loop (`sweepPendingOutboxEvents`).
  - The leader renews its lease every 3 seconds (10s TTL). If the active leader container shuts down or crashes, standby replicas detect lease expiry and elect a new leader within 2,000ms.
- **Fencing & TTL Pruning**:
  - Outbox events enforce atomic lease locking (`lockedUntil`) during publication.
  - Published events are automatically pruned after 7 days via MongoDB TTL index on `publishedAt`.

### Distributed Idempotency Key Engine
- State-mutating routes (`POST /orders/cod`) enforce the `Idempotency-Key` header.
- Atomic Redis leases prevent duplicate mutations; concurrent requests receive `409 Conflict`.
- Successful responses `{ statusCode, body }` are cached for 24 hours, transparently replaying responses with `Idempotent-Replayed: true` upon retries without re-executing database writes.

---

## 3. Endpoints

- `GET /user-orders`: Retrieve authenticated customer's order history (guarded by `shouldBeUser`).
- `GET /orders`: Retrieve all customer orders (admin only, guarded by `shouldBeAdmin`).
- `GET /order-chart`: Retrieve 6-month aggregated order totals and success counts (admin only).
- `POST /orders/cod`: Create a Cash-On-Delivery order (guarded by `shouldBeUser` + `Idempotency-Key`).
- `GET /health`: Health check (`status`, `uptime`, `timestamp`, `redis`, `mongo`).
- `GET /metrics`: Prometheus performance telemetry.

---

## 4. Kafka Event Integrations

### Consumes
- `payment.successful`: Begins Multi-DB checkout saga in `pending_confirmation`.
- `inventory.stock.sold`: First ACK in the Dual-ACK saga.
- `tax.calculation.completed`: Second ACK in the Dual-ACK saga.
- `tax.calculation.failed` / `inventory.reservation.failed`: Triggers saga rollback and automated refund.

### Emits (via Transactional Outbox)
- `order.created`: Consumed by `email-service` for customer receipts and `recommendation-service`.
- `order.confirmed`: Emitted after Dual-ACK confirmation.
- `order.cancelled`: Emitted upon saga compensation or customer cancellation.
- `payment.refund.requested`: Dispatched to `payment-service` to initiate automated Stripe refund.
- `inventory.reservation.cancelled`: Dispatched to `inventory-service` to unblock stock.
- `tax.calculation.voided`: Dispatched to `tax-service` to void tax calculation.

---

## 5. Environment Variables

Copy `.env.example` to `.env`:

```env
# MongoDB Connection (Hashed sharded cluster or standalone)
MONGO_URL=mongodb://root:example@localhost:27017/order_db?authSource=admin
MONGO_SYNC_INDEXES=false

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_...

# Redis (Leader Election, Idempotency, and Chart Cache)
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=order:v1:
ORDER_CHART_CACHE_TTL_SECONDS=60

# Kafka Event Bus
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=order-service
KAFKA_GROUP_ID=order-service-group
```

---

## 6. Testing & Development Commands

```bash
# Run service in development mode
pnpm --filter order-service dev

# Type check TypeScript codebase
pnpm --filter order-service check-types

# Execute standalone test suites (Security, Saga, Outbox, Sharding, Idempotency, Chaos Resilience)
pnpm --filter order-service test
```
