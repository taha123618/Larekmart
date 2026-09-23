# AGENTS.md — packages/order-db

Scope: `packages/order-db` only. Root rules still apply — start there.

## What this package is

Mongoose connection and `Order` model for order-service (MongoDB). It is consumed at runtime
by `order-service` and takes type dependencies from `@repo/types`.

## Public API

- `Order` model.
- `OrderStatus`, `OrderSchemaType`.
- `connectOrderDB` connection helper.
- `syncOrderIndexes` — reconciles MongoDB's indexes with the schemas.

## MongoDB index sync

`connectOrderDB` runs `syncOrderIndexes()` once the connection is open. Mongoose's default
`autoIndex` only ever _creates_ indexes, so an index removed from a schema would linger in
the database forever as dead write overhead; `syncIndexes()` also **drops any index no
schema declares** (`_id` is always kept), which is what keeps the database and the models
from drifting apart.

That drop is destructive by design: an index added directly in MongoDB for a hot query will
be removed. It is therefore opt-out outside production and opt-in inside it:

| `MONGO_SYNC_INDEXES` | Behaviour                                          |
| -------------------- | -------------------------------------------------- |
| unset                | syncs everywhere except when `NODE_ENV=production` |
| `true`               | syncs in every environment, including production   |
| `false`              | never syncs, in any environment                    |

Only set `true` in production once you are confident no hand-managed indexes exist there.
A failed sync is logged and never thrown, so a database problem surfaces as missing indexes
(performance) rather than a service that will not start.

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
- No general JavaScript test runner exists yet; verify the package with type-checking and a local MongoDB connection when needed.
