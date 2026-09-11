# AGENTS.md — apps/payment-service (Stripe)

Scope: `apps/payment-service` only. Root rules still apply — start there.

## What this service is

Hono service on `:8002`. It owns Stripe checkout sessions, Stripe webhook handling, and
Stripe product sync driven by Kafka. It emits `payment.successful` after verifying
`checkout.session.completed`.

## Where things live

- `src/index.ts` — Hono server bootstrap, middleware, route mounting, health, test route.
- `src/routes/` — session route, webhook route.
- `src/middleware/` — auth middleware (`shouldBeUser`, `shouldBeAdmin`) built with
  `@hono/clerk-auth`.
- `src/utils/subscriptions.ts` — Kafka subscriptions for Stripe product sync and order
  creation (`createStripeProduct`, `deleteStripeProduct`).
- `src/utils/...` — any payment-side helpers.

## Framework and style

- Hono, ESM (`"type": "module"`).
- Route modules are mounted with `app.route(...)`.
- Auth middleware uses Hono’s `createMiddleware` pattern. Keep the existing guard names:
  `shouldBeUser`, `shouldBeAdmin`.
- Local imports use explicit `.js` extensions where the file already does; match the file
  you are editing.
- This is the only workspace with a `build` step (`tsc` → `dist/`). It also has `start`
  (`node dist/index.js`).

## Auth and authorization

- Clerk via `@hono/clerk-auth`.
- Checkout session creation requires a user (`shouldBeUser`).
- Webhook handling is signed and verified with Stripe; it is not a normal authenticated
  user request.

## Stripe integration

- Custom checkout UI mode (`ui_mode: "custom"`).
- Prices fetched live from Stripe; do not hardcode price objects when the existing code
  fetches them.
- Webhook signature verification must use
  `stripe.webhooks.constructEvent(body, sig, webhookSecret)` with raw request text, not
  parsed JSON.
- Send amounts in the smallest currency unit (cents); the codebase multiplies by `100` where
  appropriate.

## Events

- Consume Kafka through `@repo/kafka`.
- Current subscriptions from this service: `product.created` and `product.deleted` for Stripe
  product sync.
- Emits `payment.successful` from the verified Stripe webhook.
- Use the `{ value: payload }` envelope and read `message.value` in handlers.
- If you change a payload, update the producer, every consumer, `@repo/types`, and
  `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.

## Error handling

- Return `{ message }` JSON with the correct status.
- Kafka handlers must catch and log so a bad message does not kill the consumer loop.
- Webhook failures should be handled explicitly; do not let an unverified webhook drive
  business logic.

## Health and observability

- Expose `GET /health` returning `{ status, uptime, timestamp }`.
- Logging is `console.log`/`console.error`. Keep it structured and sparse.

## What not to do

- Do not switch frameworks.
- Do not access order or product databases here.
- Do not import frontend code.
- Do not hardcode Stripe secrets; read from env and add new keys to `.env.example`.

## Verification

- `pnpm --filter payment-service check-types`
- `pnpm --filter payment-service build`
- Manual flows against running Stripe test keys + Kafka.
- No test runner exists yet.
