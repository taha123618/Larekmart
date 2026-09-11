# AGENTS.md — apps/product-service (catalog)

Scope: `apps/product-service` only. Root rules still apply — start there.

## What this service is

Express 5 service on `:8000`. It owns the product and category catalog with Prisma and
PostgreSQL. It publishes `product.created` and `product.deleted` for Stripe sync.

## Where things live

- `src/index.ts` — server bootstrap, middleware, routes, health, and test routes.
- `src/routes/` — Express routers: `product.route.ts`, `category.route.ts`.
- `src/middleware/` — auth middleware (`shouldBeUser`, `shouldBeAdmin`) via
  `@clerk/express`.
- `src/controllers/` — product controller with create/list/update/delete logic and
  Kafka publishing.
- `src/utils/` — any service-level helpers.

## Framework and style

- Express 5, ESM (`"type": "module"`).
- Local imports use explicit `.js` extensions in files that already do; match the file you
  are editing rather than mixing styles inside one file.
- Route shape mirrors existing files: `router.get/post/put/delete` on a `Router`, then mount
  it on the app.
- Shared auth middleware names are fixed: `shouldBeUser` and `shouldBeAdmin`. Do not invent
  new guard names.

## Auth and authorization

- Clerk via `@clerk/express`: `getAuth` for token validation, `clerkMiddleware` for session
  setup.
- Admin-only mutations use `shouldBeAdmin`: `PUT /products/:id`, `DELETE /products/:id`,
  `POST/PUT/DELETE /categories/...`.
- **Known gap:** `POST /products` is currently unguarded. If you touch product creation,
  review whether it should become admin-only and align with the rest of the mutation routes.

## Persistence

- Prisma via `@repo/product-db`. Do not create ad-hoc DB Clients or bypass the generated
  client.
- Do not edit `packages/product-db/generated/**`. Change the Prisma schema and regenerate.
- Models of interest: `Product`, `Category`.

## Events

- Publish Kafka events through `@repo/kafka`, not raw `kafkajs`.
- Use the `{ value: payload }` envelope and let the consumer handle parsing.
- Current topics from this service: `product.created`, `product.deleted`.
- If you change a payload, update the producer, every consumer, `@repo/types`, and
  `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.

## Error handling

- Return `{ message }` JSON with the correct status code.
- Use the existing global error handler pattern in the Express service; do not leak internals
  in production responses.
- Async work (including publishing) should not crash the request path silently; log failures
  where appropriate.

## Health and observability

- Expose `GET /health` returning `{ status, uptime, timestamp }`.
- Logging is `console.log`/`console.error`. Keep it structured and sparse.

## What not to do

- Do not add a second framework.
- Do not access MongoDB or order data here.
- Do not import frontend code.
- Do not hardcode service URLs or secrets outside env vars.

## Verification

- `pnpm --filter product-service check-types`
- After Prisma changes: `pnpm --filter @repo/product-db db:generate` then `pnpm check-types`
  from root.
- Manual flows against running Postgres + Kafka.
- No test runner exists yet.
