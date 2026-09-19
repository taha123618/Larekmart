# `@repo/cart-db`

MongoDB persistence layer for `cart-service` using **Mongoose 8** (no Prisma).

## Models

- `Cart`: Persistent customer cart (authenticated `userId` or anonymous `guestToken`) with embedded items, adjustments, coupons, pricing, and historical snapshots.
- `ProcessedEvent`: Event deduplication model ensuring idempotent Kafka consumption.

## Exports

- `connectCartDB(mongoUrl?: string)`: Connection manager
- `closeCartDB()`: Graceful shutdown handler
- `isCartDbConnected()`: Health check helper
- `Cart`, `ProcessedEvent`: Mongoose models
- TypeScript types: `CartDocType`, `CartItemDocType`, `CartCouponDocType`, etc.
