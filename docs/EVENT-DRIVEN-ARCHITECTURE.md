# Event-driven architecture

Backend services in Larekmart integrate **only** through Kafka. This document is the
contract registry: every topic, its payload, who produces it, and who consumes it.
When you change a payload you must update this file, `@repo/types`, the producer, and
every consumer together.

## Infrastructure

Local Kafka is provided by `packages/kafka/docker-compose.yml`:

- 3 brokers (`confluentinc/cp-kafka:7.5.0`) on `localhost:9094`, `:9095`, `:9096`
- ZooKeeper on `:2181`
- Kafka UI on `http://localhost:8080`
- `KAFKA_CLUSTER_ID`-style fixed `CLUSTER_ID`, replication factor 3 for internal topics

Start it with:

```bash
docker compose -f packages/kafka/docker-compose.yml up -d
```

The client is created with `createKafkaClient(<serviceName>)`, which sets `clientId` and
the three broker addresses (currently hardcoded in `packages/kafka/src/client.ts`).

## Conventions

- **Topic naming:** `<entity>.<past-tense-event>` — `product.created`, `payment.successful`.
- **Payload envelope:** producers always send `{ value: <payload> }`. `@repo/kafka`'s
  `producer.send(topic, message)` JSON-stringifies the object, and the consumer parses it,
  so handlers receive that same object and read **`message.value`**.

  ```ts
  // producer
  producer.send("order.created", { value: { email, amount, status } });

  // consumer
  consumer.subscribe([
    {
      topicName: "order.created",
      topicHandler: async (message) => {
        const { email, amount, status } = message.value;
      },
    },
  ]);
  ```

- **Consumer groups:** one per service (`<service>-group`, or the service name for
  `email-service`). A topic is subscribed once per consumer instance.
- **Delivery:** subscriptions use `fromBeginning: true`. A new consumer group therefore
  replays the topic's history — make handlers tolerant of re-processing.
- **Failure handling:** the consumer wrapper catches errors per message and logs them, so
  one bad message does not stop the loop. There is no dead-letter topic or retry policy
  yet; treat handler failures as observable, not fatal.

## Topic registry

| Topic                | Producer        | Consumer(s)                       | Payload (`message.value`)                                                  |
| -------------------- | --------------- | --------------------------------- | -------------------------------------------------------------------------- |
| `product.created`    | product-service | payment-service, analytic-service | `StripeProductType` → `{ id: string, name: string, price: number }`        |
| `product.deleted`    | product-service | payment-service, analytic-service | `number` (the product id)                                                  |
| `user.created`       | auth-service    | email-service, analytic-service   | `{ username: string, email: string }`                                      |
| `order.created`      | order-service   | email-service, analytic-service   | `{ email: string, amount: number, status: "success" \| "failed" }`         |
| `payment.successful` | payment-service | order-service, analytic-service   | `{ userId, email, amount, status, products: { name, quantity, price }[] }` |

### `product.created`

Emitted after a product row is written. Used to mirror the catalog into Stripe.

```jsonc
{ "value": { "id": "42", "name": "Adidas CoreFit T-Shirt", "price": 59 } }
```

- Producer: `apps/product-service/src/controllers/product.controller.ts`
- Consumer: `apps/payment-service/src/utils/subscriptions.ts` → `createStripeProduct`

### `product.deleted`

Emitted after a product is deleted; carries the numeric id.

```jsonc
{ "value": 42 }
```

- Consumer: `deleteStripeProduct` in payment-service.

### `user.created`

Emitted after `clerkClient.users.createUser` succeeds.

```jsonc
{ "value": { "username": "johndoe", "email": "johndoe@example.com" } }
```

- Producer: `apps/auth-service/src/routes/user.route.ts`
- Consumer: `apps/email-service/src/index.ts` → welcome email.

### `order.created`

Emitted after an order is persisted. Note `amount` is in the smallest currency unit
(cents) as returned by Stripe.

```jsonc
{
  "value": {
    "email": "johndoe@example.com",
    "amount": 5990,
    "status": "success",
  },
}
```

- Producer: `apps/order-service/src/utils/order.ts`
- Consumer: email-service → order confirmation email (`amount / 100`).

### `payment.successful`

Emitted from the verified Stripe webhook on `checkout.session.completed`.

```jsonc
{
  "value": {
    "userId": "user_...",
    "email": "johndoe@example.com",
    "amount": 5990,
    "status": "success",
    "products": [{ "name": "CoreFit T-Shirt", "quantity": 1, "price": 5900 }],
  },
}
```

- Producer: `apps/payment-service/src/routes/webhooks.route.ts`
- Consumer: `apps/order-service/src/utils/subscriptions.ts` → `createOrder`

## Adding or changing an event

1. Decide whether the change is additive (new optional field) or breaking (rename,
   type change, removal). Treat anything non-additive as breaking.
2. Update the payload's TypeScript type in `@repo/types` (or the package that owns it).
3. Update the producer.
4. Update **every** consumer and its handler.
5. Update this registry table and the topic's section above.
6. Update the relevant `AGENTS.md`/skill if the convention itself changed.
7. Verify by running the producer and consumer against local Kafka and inspecting the
   topic in Kafka UI at `:8080`.

> Because `fromBeginning: true` is enabled, a changed payload can be replayed into
> consumers as soon as a new group starts. Keep consumers defensive about missing or
> legacy fields.
