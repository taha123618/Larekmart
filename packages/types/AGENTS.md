# AGENTS.md — packages/types

Scope: `packages/types` only. Root rules still apply — start there.

## What this package is

The contract package for the monorepo. It holds shared types, Zod schemas, Kafka payload
types, and constants that cross workspace boundaries.

It is the deliberate exception to the “packages are leaf-ward” rule: it depends on
`@repo/product-db` and `@repo/order-db` so it can re-export persistence-derived domain
shapes. Keep that coupling type-only.

## Public API

Exports come through the `exports` map in `packages/types/package.json`. Consumers resolve
through that map, not through the stale `main` field.

## What belongs here

- Cross-boundary types and Zod schemas.
- Kafka payload shapes consumed or produced by more than one workspace.
- Shared constants used by multiple apps/services.

## What does not belong here

- App-specific view types that only one frontend needs.
- Service-internal request/response types that never cross a boundary.
- Runtime logic that would drag Prisma/Mongoose into frontend bundles.

## Type-only dependency discipline

- Prefer `import type` for persistence-derived types.
- Do not introduce runtime imports from `@repo/product-db` or `@repo/order-db` here unless
  the package genuinely needs them and you accept the bundle impact.
- Avoid cycles. `@repo/types` already sits on top of both DB packages by design.

## Schema maintenance

- Zod schemas such as `ProductFormSchema`, `CategoryFormSchema`, `UserFormSchema`, and
  shipping schemas live here so both frontends and backends can reuse them.
- If you change a schema, check both the admin forms and any server-side validation that
  depends on it.

## What not to do

- Do not duplicate types across apps/services when they belong here.
- Do not weaken strict TypeScript to make something compile.
- Do not add a runtime dependency just because a type happens to come from another package.

## Verification

- `pnpm --filter @repo/types check-types`
- After changing exports, run `pnpm check-types` from the root to catch downstream breaks.
- No test runner exists yet. Prefer pure unit tests for Zod schemas if/when tests are added.
