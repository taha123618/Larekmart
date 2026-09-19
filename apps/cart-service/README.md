# Cart Service (`apps/cart-service`)

High-performance, event-driven Cart microservice for Larekmart.

## Tech Stack

- **Runtime**: Node.js ≥ 18 (ESM)
- **Language**: TypeScript 5.9
- **Framework**: Express 5
- **Database**: MongoDB via `@repo/cart-db` (Mongoose 8, **no Prisma**)
- **Cache**: Redis (`@repo/redis`)
- **Messaging**: Apache Kafka (`@repo/kafka`)
- **Auth**: Clerk (`@clerk/express`) + Anonymous UUIDv4 guest token resolution
- **Observability**: `@repo/monitoring` (Prometheus metrics & multi-dependency health checks)
- **Port**: `8009`

## Key Capabilities

- **Dual Identity**: Persistent authenticated user carts (`userId`) and anonymous guest carts (`guestToken`).
- **Explicit Cart Merge**: Merges guest items into authenticated carts on login, combining identical variants up to capacity limits.
- **Optimistic Concurrency**: `version` counter preventing lost updates across tabs or devices.
- **Redis Cache & Scheduled Expirations**: Read-through cache + sorted sets for automated background expiration.
- **Estimated Pricing Snapshots**: Calculates subtotal, coupon discounts, shipping estimates, and taxes while maintaining decoupling from final checkout/order validation.

## Environment Variables

Copy `.env.example` to `.env`:

```env
PORT=8009
NODE_ENV=development
MONGO_URL=mongodb://localhost:27017/ecommerce
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=cart:v1:
KAFKA_BROKERS=localhost:9092,localhost:9093,localhost:9094
KAFKA_CLIENT_ID=cart-service
KAFKA_GROUP_ID=cart-service-group
CLERK_SECRET_KEY=sk_test_...
PRODUCT_SERVICE_URL=http://localhost:8000
INVENTORY_SERVICE_URL=http://localhost:8007
GUEST_CART_TTL_SECONDS=604800
USER_CART_TTL_SECONDS=2592000
CART_CACHE_TTL_SECONDS=300
```

## Commands

```bash
# Run in dev mode
pnpm --filter cart-service dev

# Type check
pnpm --filter cart-service check-types
```
