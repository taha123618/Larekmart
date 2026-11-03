---
name: order-processing
description: Use when modifying order persistence, MongoDB aggregations, Fastify route plugins, or Kafka payment/order subscriptions in apps/order-service.
---

# Order Processing & Analytics Workflows

Guidance for developing in `apps/order-service` (Fastify 5, port 8001).

## 1. Fastify Plugins & Route Architecture

- Route definitions are structured as Fastify plugin functions in `src/routes/order.ts`.
- Routes:
  - `GET /user-orders`: Queries orders matching the authenticated session's `userId` (preHandler: `shouldBeUser`).
  - `GET /orders`: Admin view of all customer orders (preHandler: `shouldBeAdmin`).
  - `GET /order-chart`: 6-month MongoDB aggregation pipeline grouping orders by month and status.
  - `GET /health`: Health check endpoint.

## 2. Event Consumption & Order Creation

- Kafka consumer connects on service startup and subscribes to `payment.successful`:

  ```ts
  const createOrder = async (orderData: PaymentSuccessfulType) => {
    const newOrder = new Order(orderData);
    await newOrder.save();

    await producer.send("order.created", {
      value: {
        orderId: newOrder._id.toString(),
        userId: newOrder.userId,
        email: newOrder.email,
        amount: newOrder.amount,
        status: newOrder.status,
        products: newOrder.products.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          price: p.price,
        })),
      },
    });
  };
  ```

- Handles message idempotency safely given `fromBeginning: true`.

## 3. Transactional Outbox & Leader Election

- All domain state mutations (`POST /orders/cod`, `payment.successful`) persist outbox events to MongoDB (`OutboxEvent`) within the same ACID transaction session.
- **Distributed Leader Election (`DistributedLeaderElector`)**:
  - Horizontal pods elect a single active sweeper leader using key `order:outbox:sweeper:leader` with 10s TTL and 3s heartbeat renewals.
  - Heartbeat renewals run inside an isolated, high-priority background loop completely decoupled from application request I/O.
  - Generates a monotonically increasing `fencingToken` verified by MongoDB atomic update conditions before batch claims, preventing heartbeat drift from triggering duplicate Kafka dispatches.

## 4. Verification

```bash
pnpm --filter order-service check-types
pnpm --filter order-service test
```
