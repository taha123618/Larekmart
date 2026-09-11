# AGENTS.md — packages/order-db

Scope: `packages/order-db` only. Root rules still apply — start there.

## What this package is

Mongoose connection and `Order` model for order-service (MongoDB). It is consumed at runtime
by `order-service` and takes type dependencies from `@repo/types`.

## Public API

- `Order` model.
- `OrderStatus`, `OrderSchemaType`.
- `connectOrderDB` connection helper.

## Dependency direction

- `order-service` is the primary runtime consumer.
- `@repo/types` may import types from this package, but keep that import type-only.
- Do not let frontend code depend on `@repo/order-db` at runtime.

## What not to do

- Do not create ad-hoc Mongo clients in services; use the package surface.
- Do not add app-specific logic here.
- Do not let this package depend on apps.

## Verification

- `pnpm --filter @repo/order-db check-types`
- After changes, `pnpm check-types` from root to catch downstream breaks.
- No test runner exists yet.
