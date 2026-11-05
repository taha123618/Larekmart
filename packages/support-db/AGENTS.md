# AGENTS.md — packages/support-db

Scope: `packages/support-db` only. Root rules still apply — start there.

## What this package is

Shared PostgreSQL database layer and Prisma client for `support-service`.
It contains the schema and models for `tickets`, `ticket_messages`, `ticket_assignments`, `ticket_categories`, `ticket_sla_policies`, and `ticket_history`.

## Generated Code Rule

Never edit `generated/prisma/**` directly. Edit `prisma/schema.prisma` instead and run:
`pnpm --filter @repo/support-db db:generate`
