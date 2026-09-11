# `@repo/product-db`

Prisma schema and client for the PostgreSQL catalog database used by `product-service`.

## Public API

- `prisma`: Instantiated PrismaClient singleton.
- Re-exports of generated Prisma types (`Product`, `Category`).

## Schema (`prisma/schema.prisma`)

- `Category`: `id`, `name`, `slug`, `image`, relation to `Product[]`.
- `Product`: `id`, `name`, `description`, `category` (relation), `price`, `colors` (`String[]`), `sizes` (`String[]`), `images` (`Json` color-to-image mapping), `createdAt`, `updatedAt`.

## Database Commands

```bash
# Generate Prisma Client
pnpm --filter @repo/product-db db:generate

# Apply migrations in development
pnpm --filter @repo/product-db db:migrate

# Apply migrations in production
pnpm --filter @repo/product-db db:deploy

# Type check
pnpm --filter @repo/product-db check-types
```
