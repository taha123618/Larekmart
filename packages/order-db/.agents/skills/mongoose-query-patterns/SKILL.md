---
name: mongoose-query-patterns
description: Use when writing Mongoose queries, index definitions, projections, or lean queries in packages/order-db.
---

# Mongoose Query Patterns & Best Practices

Guidance for database operations in `@repo/order-db`.

## 1. Indexed Queries

- `userId` is indexed on the `Order` model for rapid retrieval of user order histories:
  ```ts
  const userOrders = await Order.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
  ```

## 2. Performance with `.lean()`

- Use `.lean()` for read-only queries (e.g. `GET /orders`, `GET /user-orders`) to avoid Mongoose document instantiation overhead.

## 3. Order Status Integrity

- Always validate `status` against `OrderStatus` tuple (`"success" | "failed"`).
