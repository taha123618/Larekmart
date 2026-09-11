# Order Service (`apps/order-service`)

Microservice responsible for order persistence, order history retrieval, and 6-month order analytics aggregations.

## Tech Stack

- **Framework**: Fastify 5
- **Database**: MongoDB via Mongoose (`@repo/order-db`)
- **Messaging**: Apache Kafka (`@repo/kafka`)
- **Auth**: Clerk (`@clerk/fastify`)
- **Port**: `8001`

## Endpoints

- `GET /user-orders`: Retrieve authenticated customer's order history (guarded by `shouldBeUser`).
- `GET /orders`: Retrieve all customer orders (admin only, guarded by `shouldBeAdmin`).
- `GET /order-chart`: Retrieve 6-month aggregated order totals and success counts (admin only).
- `GET /health`: Health check (`status`, `uptime`, `timestamp`).

## Event Integrations

- **Consumes**:
  - `payment.successful`: Persists the completed order in MongoDB and emits `order.created`.
- **Emits**:
  - `order.created`: Consumed by `email-service` for customer receipt delivery.

## Environment Variables

Copy `.env.example` to `.env`:

```env
MONGO_URL=mongodb://localhost:27017/ecommerce
CLERK_SECRET_KEY=sk_test_...
```

## Development Commands

```bash
# Run standalone
pnpm --filter order-service dev

# Type check
pnpm --filter order-service check-types
```
