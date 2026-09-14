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

| Topic                             | Producer             | Consumer(s)                                                              | Payload (`message.value`)                                                                                         |
| --------------------------------- | -------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `product.created`                 | product-service      | payment-service, analytic-service, search-service                        | `ProductCreatedPayload` (superset of `StripeProductType`)                                                         |
| `product.updated`                 | product-service      | search-service                                                           | `ProductType`, or `ProductCreatedPayload` on a backfill replay                                                    |
| `product.deleted`                 | product-service      | payment-service, analytic-service, search-service                        | `number` (the product id)                                                                                         |
| `user.created`                    | auth-service         | email-service, analytic-service, notification-service                    | `{ username: string, email: string }`                                                                             |
| `order.created`                   | order-service        | email-service, analytic-service, notification-service                    | `{ email: string, amount: number, status: "success" \| "failed" }`                                                |
| `payment.successful`              | payment-service      | order-service, analytic-service, notification-service, inventory-service | `{ sessionId, referenceId, reservationId, userId, email, amount, status, products: { name, quantity, price }[] }` |
| `notification.dispatch`           | any backend service  | notification-service                                                     | `{ userId, type, title, body, email, phone, metadata }`                                                           |
| `email.dispatch`                  | notification-service | email-service                                                            | `{ email, subject, text, html, context }`                                                                         |
| `inventory.created`               | inventory-service    | none yet                                                                 | `InventoryChangedPayload`                                                                                         |
| `inventory.reserved`              | inventory-service    | none yet                                                                 | `InventoryChangedPayload` + reservation fields                                                                    |
| `inventory.reservation.confirmed` | inventory-service    | none yet                                                                 | `InventoryChangedPayload` + reservation fields                                                                    |
| `inventory.stock.sold`            | inventory-service    | analytic-service                                                         | `InventoryChangedPayload` + reservation fields                                                                    |
| `inventory.released`              | inventory-service    | none yet                                                                 | `InventoryChangedPayload` + reservation fields                                                                    |
| `inventory.reservation.expired`   | inventory-service    | none yet                                                                 | `InventoryChangedPayload` + reservation fields                                                                    |
| `inventory.restocked`             | inventory-service    | analytic-service                                                         | `InventoryChangedPayload`                                                                                         |
| `inventory.adjusted`              | inventory-service    | none yet                                                                 | `InventoryChangedPayload`                                                                                         |
| `inventory.low_stock`             | inventory-service    | notification-service, analytic-service                                   | `InventoryChangedPayload`                                                                                         |

### `product.created`

Emitted after a product row is written. Used to mirror the catalog into Stripe and index into OpenSearch.

The payload is the full product (`ProductCreatedPayload`), a superset of `StripeProductType`.
The rich fields let search-service index images, sizes, and colors immediately — a freshly
created product is searchable with facets without waiting for an update event — while
payment-service still finds the `id`/`name`/`price` it mirrors into Stripe.

```jsonc
{
  "value": {
    "id": "42",
    "name": "Adidas CoreFit T-Shirt",
    "price": 59,
    "shortDescription": "Soft cotton tee",
    "description": "Soft cotton tee with a relaxed fit.",
    "categorySlug": "t-shirts",
    "sizes": ["s", "m", "l"],
    "colors": ["black", "white"],
    "images": { "black": "/products/1bl.png", "white": "/products/1w.png" },
    "createdAt": "2026-09-13T10:00:00.000Z",
    "updatedAt": "2026-09-13T10:00:00.000Z",
  },
}
```

- Producer: `apps/product-service/src/controllers/product.controller.ts`
- Consumer: `apps/payment-service/src/utils/subscriptions.ts`, `apps/search-service/src/consumers/product-events.consumer.ts`

### `product.updated`

Emitted after a product row is updated. Used to update the denormalized document in OpenSearch.

```jsonc
{ "value": { "id": 42, "name": "Adidas CoreFit T-Shirt Pro", "price": 65 } }
```

The consumer fills anything missing with defaults, so a partial update leaves `images`,
`sizes`, and `colors` as they were. Send the whole product when a change affects what the
storefront renders or facets on.

`product-service` also **replays the catalog on this topic** to heal documents that were
indexed before `product.created` carried the full product
(`pnpm --filter product-service backfill:search`); those replays send
`ProductCreatedPayload`. search-service is the only consumer today, so a full replay has no
side effects on other services — but if you subscribe a new service here, remember it can
receive the entire catalog at once.

- Producer: `apps/product-service/src/controllers/product.controller.ts`, `apps/product-service/src/search/backfill.ts`
- Consumer: `apps/search-service/src/consumers/product-events.consumer.ts`

### `product.deleted`

Emitted after a product is deleted; carries the numeric id.

```jsonc
{ "value": 42 }
```

- Producer: `apps/product-service/src/controllers/product.controller.ts`
- Consumer: `apps/payment-service/src/utils/subscriptions.ts`, `apps/search-service/src/consumers/product-events.consumer.ts`

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
    "sessionId": "cs_test_...",
    "referenceId": "cs_test_...",
    "reservationId": "res_...",
    "userId": "user_...",
    "email": "johndoe@example.com",
    "amount": 5990,
    "status": "success",
    "products": [{ "name": "CoreFit T-Shirt", "quantity": 1, "price": 5900 }],
  },
}
```

- Producer: `apps/payment-service/src/routes/webhooks.route.ts`
- Consumers:
  - `apps/order-service/src/utils/subscriptions.ts` → `createOrder`
  - `apps/inventory-service/src/workers/inventory-event.consumer.ts` → `confirmReservationsByReference` (converts reserved stock to sold stock)

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
