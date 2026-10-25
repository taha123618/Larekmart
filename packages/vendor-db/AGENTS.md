# AGENTS.md — packages/vendor-db

Scope: `packages/vendor-db` only. Root rules still apply — start there.

## What this package is

Shared PostgreSQL database layer and Prisma client for `vendor-service`.
It contains the schema and models for `vendors`, `vendor_business_profiles`, `vendor_documents`,
`vendor_verifications`, `vendor_members`, and `vendor_status_history`.

## Generated Code Rule

Never edit `generated/prisma/**` directly. Edit `prisma/schema.prisma` instead and run:
`pnpm --filter @repo/vendor-db db:generate`
