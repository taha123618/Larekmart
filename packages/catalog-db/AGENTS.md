# AGENTS.md — @repo/catalog-db

## Purpose

PostgreSQL schema and generated Prisma client for `catalog-service` read models.

## Rules

- Never import code from applications into this package.
- Generated code in `generated/prisma/**` is created by `prisma generate` and is gitignored.
- Dual Prisma client pattern: `prisma` is for primary write-plane transactions; `readPrisma` is for read-replica storefront browsing queries. Use `getCatalogDb(forcePrimary?: boolean)` to dynamically resolve between `prisma` (when Read-Your-Writes is active) and `readPrisma` (for normal browsing).
- Run `pnpm --filter @repo/catalog-db db:generate` after modifying `prisma/schema.prisma`.
