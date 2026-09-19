# AGENTS.md — packages/cart-db

Scope: `packages/cart-db` only. Root rules apply.

## What this package is

MongoDB persistence package using **Mongoose 8** for `cart-service`.

## Golden Rules

- **No Prisma**: This package strictly uses Mongoose. Do not add Prisma.
- **Leaf-ward**: Depends only on `@repo/typescript-config` and `mongoose`.
- **Exports**: Models, connection functions, and inferred types exported from `src/index.ts`.
