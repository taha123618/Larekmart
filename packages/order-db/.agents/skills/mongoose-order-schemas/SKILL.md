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

## 2. Connection Helper (`src/connection.ts`)

- `connectOrderDB()` handles connection lifecycle via `MONGO_URL`.

## 3. Dependency Discipline

- `@repo/types` re-exports the order schema type using `import type` to ensure frontend builds do not pull in Mongoose.

## 4. Verification

```bash
pnpm --filter @repo/order-db check-types
```
