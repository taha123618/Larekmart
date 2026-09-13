---
name: contract-management
description: Use when modifying shared domain types, Kafka payload interfaces, Zod form schemas, or exports in packages/types.
---

# Contract Management & Schema Evolution

Guidance for maintaining `@repo/types` — the central contract repository of Larekmart.

## 1. What Belongs in `@repo/types`

- Cross-boundary domain types: `ProductType`, `CategoryType`, `OrderType`, `CartItemType`.
- Kafka payload contracts: `StripeProductType`, `UserCreatedType`, `OrderCreatedType`, `PaymentSuccessfulType`.
- Shared Zod validation schemas: `ProductFormSchema`, `CategoryFormSchema`, `UserFormSchema`, `shippingFormSchema`.
- Monorepo-wide constants: `colors`, `sizes`, `OrderStatus`, `CustomJwtSessionClaims`.

## 2. Type-Only Dependency Discipline

- `@repo/types` imports domain models from `@repo/product-db` and `@repo/order-db`.
- **CRITICAL**: Always use `import type` when referencing database schemas to avoid bundling database drivers into Next.js frontend bundles.

## 3. Modifying Contracts

1. Edit or add types in `src/`.
2. Ensure new types/schemas are exported from `src/index.ts`.
3. Verify that consumers resolve via the `exports` map in `packages/types/package.json`.
4. Run `pnpm check-types` from repository root to ensure all 21 workspaces remain synchronized.

## 4. Verification

```bash
pnpm --filter @repo/types check-types
pnpm check-types
```
