# AGENTS.md — @repo/catalog-db

## Purpose

PostgreSQL schema and generated Prisma client for `catalog-service` read models.

## Rules

- Never import code from applications into this package.
- Generated code in `generated/prisma/**` is created by `prisma generate` and is gitignored.
- Run `pnpm --filter @repo/catalog-db db:generate` after modifying `prisma/schema.prisma`.
