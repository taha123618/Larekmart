# `@repo/order-db`

MongoDB connection wrapper and Mongoose `Order` model used by `order-service`.

## Public API

- `connectOrderDB()`: Establishes connection to MongoDB via `MONGO_URL`.
- `Order`: Mongoose model for order documents.
- `OrderStatus`: Tuple constant (`"success"`, `"failed"`).
- `OrderSchemaType`: TypeScript interface representing an order document.

## Schema

- `userId`: Clerk user identifier.
- `email`: Customer email.
- `amount`: Total order amount in cents.
- `status`: `"success" | "failed"`.
- `products`: Array of items `{ name: string, quantity: number, price: number }`.
- Timestamps: `createdAt`, `updatedAt`.

## Development Commands

```bash
pnpm --filter @repo/order-db check-types
```
