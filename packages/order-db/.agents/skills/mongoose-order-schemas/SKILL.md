---
name: mongoose-order-schemas
description: Use when modifying the MongoDB Order schema, Mongoose connection helpers, or order status definitions in packages/order-db.
---

# Mongoose Order Schemas & Persistence

Guidance for maintaining MongoDB persistence in `@repo/order-db`.

## 1. Schema & Model Definition (`src/order-model.ts`)

- Mongoose schema for orders:
  - `userId`: string (indexed for user order queries)
  - `email`: string
  - `amount`: number (in cents)
  - `status`: enum `OrderStatus` (`"success" | "failed"`)
  - `products`: array of subdocuments `{ name: string, quantity: number, price: number }`
  - `timestamps`: true (`createdAt`, `updatedAt`)

## 2. Indexes

Every index exists to serve a specific read path in `apps/order-service`; add one only
together with the query that needs it.

| Index               | Serves                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| `{ userId: 1 }`     | `GET /user-orders` (orders for the authenticated user)                        |
| `{ createdAt: -1 }` | `GET /orders` sorted newest-first, and the `/order-chart` date-range `$match` |

Mongoose only creates indexes in a running database when a model's `syncIndexes()`
(or `autoIndex` on first connect) runs. After changing an index here, apply it with:

```bash
cd apps/order-service
pnpm exec tsx --env-file=.env -e 'import("@repo/order-db").then(async (db) => {
  await db.connectOrderDB(); await db.Order.syncIndexes(); await db.Order.db.close();
});'
```

## 3. Connection Helper (`src/connection.ts`)

- `connectOrderDB()` handles connection lifecycle via `MONGO_URL`.

## 4. Dependency Discipline

- `@repo/types` re-exports the order schema type using `import type` to ensure frontend builds do not pull in Mongoose.

## 5. Verification

```bash
pnpm --filter @repo/order-db check-types
```
