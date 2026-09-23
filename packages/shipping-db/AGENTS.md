# @repo/shipping-db AGENTS.md

This package contains the authoritative PostgreSQL Prisma schema and client for `shipping-service`.

## Golden Rules

- Database URL points to `larekmart_shipping_db`.
- Generated client lives in `packages/shipping-db/generated/prisma` (gitignored).
- Never hand-edit files in `generated/`. Edit `prisma/schema.prisma` and run `pnpm --filter @repo/shipping-db db:generate`.
- Migrations are run via `pnpm --filter @repo/shipping-db db:migrate` in development or `db:deploy` in production.
