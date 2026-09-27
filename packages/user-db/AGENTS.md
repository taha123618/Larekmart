# AGENTS.md — @repo/user-db

## Purpose

Prisma ORM schema and client for user-service (PostgreSQL).

## Boundaries

- Never import application code into this package.
- Generated code in \`generated/prisma/\` is produced by \`prisma generate\`. Never edit it directly.
- Export \`prisma\` client instance from \`src/index.ts\`.
