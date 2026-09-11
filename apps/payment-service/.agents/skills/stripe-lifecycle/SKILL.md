---
name: stripe-lifecycle
description: Use when modifying Stripe checkout sessions, webhook handlers, price calculations, or Kafka product sync in apps/payment-service.
---

# Stripe Lifecycle & Payment Processing

Guidance for developing in `apps/payment-service` (Hono, port 8002).

## 1. Checkout Session Creation

- Endpoint: `POST /sessions/create-checkout-session` (guarded by `shouldBeUser`).
- Uses Stripe custom checkout mode (`ui_mode: "custom"`).
- Prices are converted to the smallest currency unit (cents). E.g. $59.00 -> 5900 cents.
- Returns `clientSecret` to the frontend client.

## 2. Webhook Signature Verification

- Endpoint: `POST /webhooks/stripe`.
- **CRITICAL**: Verify webhook signatures using the raw request body string:
  ```ts
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
  ```
- On `checkout.session.completed`, publish the `payment.successful` Kafka event.

## 3. Catalog Synchronization (Kafka Consumers)

- Consumes `product.created`: calls `stripe.products.create({ name, default_price_data: { currency: "usd", unit_amount: price * 100 } })`.
- Consumes `product.deleted`: archives/deletes the Stripe product.

## 4. Verification

```bash
pnpm --filter payment-service check-types
pnpm --filter payment-service build
```
