# Payment Service (`apps/payment-service`)

Microservice responsible for Stripe checkout session management, webhook signature verification, and event-driven Stripe catalog synchronization.

## Tech Stack

- **Framework**: Hono 4 (running on `@hono/node-server`)
- **Payments**: Stripe Node SDK
- **Messaging**: Apache Kafka (`@repo/kafka`)
- **Auth**: Clerk (`@hono/clerk-auth`)
- **Port**: `8002`

## Endpoints

- `POST /sessions/create-checkout-session`: Initializes a Stripe custom checkout session (guarded by `shouldBeUser`).
- `GET /sessions/:id`: Retrieves checkout session status.
- `POST /webhooks/stripe`: Receives and verifies Stripe webhook events (`checkout.session.completed`).
- `GET /health`: Service health check (`status`, `uptime`, `timestamp`).

## Event Integrations

- **Emits**: `payment.successful` (emitted on verified Stripe webhook checkout completion).
- **Consumes**:
  - `product.created`: Synchronizes new products to Stripe.
  - `product.deleted`: Removes/archives products in Stripe.

## Environment Variables

Copy `.env.example` to `.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CLERK_SECRET_KEY=sk_test_...
```

## Development Commands

```bash
# Run standalone
pnpm --filter payment-service dev

# Type check
pnpm --filter payment-service check-types

# Build (TypeScript compilation to dist/)
pnpm --filter payment-service build

# Start production build
pnpm --filter payment-service start
```
