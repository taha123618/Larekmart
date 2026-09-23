# AGENTS.md — packages/cart-db

Scope: `packages/cart-db` only. Root rules apply.

## What this package is

MongoDB persistence package using **Mongoose 8** for `cart-service`.

## Golden Rules

- **No Prisma**: This package strictly uses Mongoose. Do not add Prisma.
- **Leaf-ward**: Depends only on `@repo/typescript-config` and `mongoose`.
- **Exports**: Models, connection functions, and inferred types exported from `src/index.ts`.

## MongoDB index sync

`connectCartDB` runs `syncCartIndexes()` once the connection is open. Mongoose's default
`autoIndex` only ever _creates_ indexes, so an index removed from a schema would linger in
the database forever as dead write overhead; `syncIndexes()` also **drops any index no
schema declares** (`_id` is always kept).

That drop is destructive by design: an index added directly in MongoDB for a hot query will
be removed. It is therefore opt-out outside production and opt-in inside it:

| `MONGO_SYNC_INDEXES` | Behaviour                                          |
| -------------------- | -------------------------------------------------- |
| unset                | syncs everywhere except when `NODE_ENV=production` |
| `true`               | syncs in every environment, including production   |
| `false`              | never syncs, in any environment                    |

Both `Cart` and `ProcessedEvent` are walked automatically because `syncCartIndexes()` syncs
every model registered on the default connection. A failed sync is logged and never thrown,
so a database problem surfaces as missing indexes (performance) rather than a service that
will not start.
