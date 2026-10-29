# `@repo/order-db`

MongoDB connection wrapper, Mongoose `Order` model, and `OutboxEvent` transactional outbox infrastructure used by `order-service`.

---

## Public API

- `connectOrderDB()`: Establishes connection to MongoDB via `MONGO_URL` and syncs indexes outside production.
- `syncOrderIndexes()`: Reconciles schema indexes with MongoDB, dropping stale indexes.
- `Order`: Mongoose model for customer order documents.
- `OutboxEvent`: Mongoose model for transactional outbox records with 7-day TTL.
- `createOutboxEvent(topic, payload, options)`: Creates an outbox event within a transactional MongoDB session.
- `OrderStatus`: Tuple constant (`"pending_confirmation"`, `"confirmed"`, `"success"`, `"failed"`, `"cancelled"`).
- `OrderSchemaType`: TypeScript interface representing an order document.

---

## Horizontal Hashed Sharding & Indexes

To endure hyperscale write throughput and prevent single-instance storage I/O bottlenecks during peak shopping festivals, the `Order` collection enforces:

- **Hashed Shard Key**: `{ userId: "hashed" }`, evenly distributing customer orders across MongoDB cluster shards.
- **Compound Scatter-Gather Mitigation Indexes**:
  - `{ sellerId: 1, createdAt: -1 }`: Fast index routing for seller portal dashboard queries without scanning all shards.
  - `{ "products.sellerId": 1, createdAt: -1 }`: Line-item vendor lookup acceleration.
  - `{ status: 1, createdAt: -1 }`: Fast indexing for Dual-ACK saga background reconcilers and status queries.
  - `{ paymentSessionId: 1 }`: Fast single-document lookup for Stripe webhook idempotency.

---

## Transactional Outbox Collection (`OutboxEvent`)

- Persists outbound Kafka events atomically inside MongoDB transactions alongside order mutations.
- Enforces atomic distributed lease locking (`lockedUntil`) during background outbox sweeps.
- Automatically purges published events after 7 days via native MongoDB TTL index on `publishedAt`.

---

## Development Commands

```bash
# Type check package
pnpm --filter @repo/order-db check-types
```
