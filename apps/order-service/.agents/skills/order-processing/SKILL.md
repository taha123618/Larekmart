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

## 3. Verification

```bash
pnpm --filter order-service check-types
```
