# AGENTS.md — packages/product-db

Scope: `packages/product-db` only. Root rules still apply — start there.

## What this package is

Prisma client and schema for the product catalog (PostgreSQL). It is consumed at runtime by
`product-service` and takes type dependencies from `@repo/types`.

## Public API

- `prisma` client for product-service.
- Generated Prisma types from `packages/product-db/generated/prisma`.

## Schema and generation

- The source of truth is `packages/product-db/prisma/schema.prisma`.
- Regenerate the client with `pnpm --filter @repo/product-db db:generate`.
- Migrations: `pnpm --filter @repo/product-db db:migrate` (dev) and
  `pnpm --filter @repo/product-db db:deploy` (production).

## Immutable rule

Never edit `packages/product-db/generated/prisma/**`. It is produced by `prisma generate`
and is gitignored. Change the schema instead.

## Dependency direction

- `product-service` is the primary runtime consumer.
- `@repo/types` may import types from this package, but keep that import type-only.
- Do not let frontend code depend on `@repo/product-db` at runtime.

## What not to do

- Do not edit generated Prisma output.
- Do not bypass Prisma and create ad-hoc SQL clients in services.
- Do not add app-specific logic here.

## Verification

- `pnpm --filter @repo/product-db db:generate`
- `pnpm --filter @repo/product-db check-types`
- After schema changes, `pnpm check-types` from root to catch downstream breaks.
- Apply a migration before relying on new schema shapes in dev.
- No general JavaScript test runner exists yet; verify schema changes with Prisma generation, migrations, and type-checking.
