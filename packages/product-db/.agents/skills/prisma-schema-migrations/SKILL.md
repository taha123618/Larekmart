---
name: prisma-schema-migrations
description: Use when modifying PostgreSQL Prisma models, generating the Prisma client, or managing database migrations in packages/product-db.
---

# Prisma Schema & Database Migrations

Guidance for maintaining PostgreSQL persistence in `@repo/product-db`.

## 1. Schema Modifications

- Edit `packages/product-db/prisma/schema.prisma`.
- Models: `Product`, `Category`.
- Preserve relations (e.g. `Product.categoryId` -> `Category.id`).

## 2. Client Generation & Migrations Workflow

1. **Regenerate Client**:
   ```bash
   pnpm --filter @repo/product-db db:generate
   ```
2. **Development Migration**:
   ```bash
   pnpm --filter @repo/product-db db:migrate
   ```
3. **Production Deployment Migration**:
   ```bash
   pnpm --filter @repo/product-db db:deploy
   ```

## 3. Critical Rules

- **Never edit generated files**: `packages/product-db/generated/prisma/**` is auto-generated.
- **Type-only consumption in `@repo/types`**: `@repo/types` re-exports Prisma types using `import type` to avoid dragging Prisma client runtime into browser bundles.

## 4. Verification

```bash
pnpm --filter @repo/product-db check-types
pnpm check-types # verify downstream consumers
```
