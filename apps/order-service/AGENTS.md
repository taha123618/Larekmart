# AGENTS.md — apps/order-service (orders + analytics)

Scope: `apps/order-service` only. Root rules still apply — start there.

## What this service is

Fastify 5 service on `:8001`. It owns orders and order analytics in MongoDB via Mongoose.
It consumes `payment.successful` to create orders and publishes `order.created` for email.

## Where things live

- `src/index.ts` — Fastify bootstrap, plugins, routes, auth, health, and test route.
- `src/routes/` — order routes.
- `src/middleware/` — auth middleware (`shouldBeUser`, `shouldBeAdmin`) via `@clerk/fastify`.
- `src/utils/` — order creation logic and Kafka subscriptions.

## Framework and style

- Fastify 5, ESM (`"type": "module"`).
- Route registration uses the plugin-function pattern where the existing code does.
- Auth is applied per-route with `preHandler: shouldBeUser | shouldBeAdmin`.
- Local imports use explicit `.js` extensions where the file already does; match the file
  you are editing.

## Auth and authorization

- Clerk via `@clerk/fastify`.
- User-scoped routes use `shouldBeUser`; admin routes use `shouldBeAdmin`.
- Existing protected routes include user orders, admin orders, and the order chart.
- Derive `userId` from the session; do not trust a client-supplied `userId`.

## Persistence

- Mongoose via `@repo/order-db`. Use `Order`, `OrderStatus`, `OrderSchemaType`, and
  `connectOrderDB` as the public surface.
- Do not create ad-hoc Mongo clients or bypass the shared model.
- Order statuses: `success | failed` in the existing model.

## Events

- Consume Kafka through `@repo/kafka`.
- Current subscriptions from this service: `payment.successful` → order creation.
- This service publishes `order.created` after persisting an order.
- Use the `{ value: payload }` envelope and read `message.value` in handlers.
- Because subscriptions use `fromBeginning: true`, handlers must be tolerant of re-processing.
- If you change a payload, update the producer, every consumer, `@repo/types`, and
  `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.

## Error handling

- Return `{ message }` JSON with the correct status.
- Kafka handlers must catch and log so a bad message does not kill the consumer loop.
- There is no dead-letter topic or retry policy yet; treat handler failures as observable.

## Health and observability

- Expose `GET /health` returning `{ status, uptime, timestamp }`.
- Logging is `console.log`/`console.error`. Keep it structured and sparse.

## What not to do

- Do not add a different web framework.
- Do not access product/Postgres data here.
- Do not import frontend code.
- Do not hardcode service URLs or secrets outside env vars.

## Verification

- `pnpm --filter order-service check-types`
- Manual flows against running MongoDB + Kafka.
- No test runner exists yet.
