---
name: webhook-handling
description: Use when modifying Stripe webhook signature verification, event routing, raw body handling, or payment.successful event emission in apps/payment-service.
---

# Stripe Webhook Handling & Verification

Guidance for webhook processing in `apps/payment-service`.

## 1. Webhook Endpoint (`POST /webhooks/stripe`)

- Public endpoint receiving Stripe events.
- **CRITICAL**: Requires raw request body text (not parsed JSON) to verify cryptographic signatures.

## 2. Signature Verification

```ts
const signature = c.req.header("stripe-signature");
const rawBody = await c.req.text();

let event: Stripe.Event;
try {
  event = stripe.webhooks.constructEvent(
    rawBody,
    signature!,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
} catch (err) {
  return c.json({ message: "Webhook signature verification failed" }, 400);
}
```

## 3. Event Handling: `checkout.session.completed`

- Extract `userId`, customer `email`, total `amount`, line items, and shipping info.
- Publish `payment.successful` Kafka event:
  ```ts
  await producer.send("payment.successful", {
    value: {
      userId,
      email,
      amount,
      status: "success",
      products: items.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        price: p.price,
      })),
    },
  });
  ```
- Return `200 OK` with `{ received: true }`.
