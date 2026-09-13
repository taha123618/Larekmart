# AGENTS.md — apps/auth-service (Clerk user admin)

Scope: `apps/auth-service` only. Root rules still apply — start there.

## What this service is

Express 5 service on `:8003`. It provides admin-only user management by wrapping the Clerk
backend SDK. It emits `user.created` after a Clerk user is created.

## Where things live

- `src/index.ts` — Express bootstrap, Clerk middleware, route mounting, health, and test
  route.
- `src/routes/` — user routes.
- `src/middleware/` — auth middleware (`shouldBeUser`, `shouldBeAdmin`) via `@clerk/express`.
- `src/utils/clerk.ts` — Clerk client setup.

## Framework and style

- Express 5, ESM (`"type": "module"`).
- Auth middleware uses `@clerk/express`: `getAuth`, `clerkMiddleware`.
- Keep guard names fixed: `shouldBeUser`, `shouldBeAdmin`.
- Local imports use explicit `.js` extensions where the file already does; match the file
  you are editing.

## Auth and authorization

- This service is admin-only by design. `/users` is guarded with `shouldBeAdmin`.
- Do not expose user administration to non-admins.
- Create/update/delete users through the Clerk backend SDK, not by inventing your own user
  store.

## Events

- Publish Kafka events through `@repo/kafka`, not raw `kafkajs`.
- Current topic from this service: `user.created` after `clerkClient.users.createUser`.
- Use the `{ value: payload }` envelope.
- If you change a payload, update the producer, every consumer, `@repo/types`, and
  `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.

## Error handling

- Return `{ message }` JSON with the correct status.
- Use the existing global error handler pattern; do not leak internals.
- Async work, including publishing, should not crash the request path silently; log failures
  where appropriate.

## Health and observability

- Expose `GET /health` returning `{ status, uptime, timestamp }`.
- Logging is `console.log`/`console.error`. Keep it structured and sparse.

## What not to do

- Do not add a custom auth system; Clerk is the auth backbone.
- Do not access order/product databases here.
- Do not import frontend code.
- Do not hardcode Clerk secrets; read from env and add new keys to `.env.example`.

## Verification

- `pnpm --filter auth-service check-types`
- Manual flows against running Kafka.
- No general JavaScript test runner exists yet; verify this service with its type-check and manual Kafka flows.
