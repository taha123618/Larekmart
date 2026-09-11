# GitHub Copilot instructions — Larekmart

Canonical rules live in [`AGENTS.md`](../AGENTS.md); scoped rules live in
`apps/*/AGENTS.md` and `packages/*/AGENTS.md`. Prefer those files when they conflict
with this summary.

## Repository Architecture

pnpm 9 + Turborepo monorepo for a microservices clothing e-commerce platform. Two
Next.js apps (`client` :3002, `admin` :3003), five backend services (`product-service` :8000,
`order-service` :8001, `payment-service` :8002, `auth-service` :8003,
`email-service` worker), and shared packages (`@repo/kafka`, `@repo/types`,
`@repo/product-db`, `@repo/order-db`, `@repo/eslint-config`, `@repo/typescript-config`).

## AI Agent Lifecycle

### 1. Before Making Changes

- Understand architecture boundaries (`docs/ARCHITECTURE.md`, `docs/DEPENDENCIES.md`).
- Search for reusable contracts in `@repo/types` (do not duplicate Zod schemas or types).
- Identify which workspaces are in scope.

### 2. While Making Changes

- Use `pnpm` and `pnpm --filter <workspace>`, never npm/yarn.
- Maintain dependency direction: apps → packages; never import app code across apps.
- Integrate backend services **only** through Kafka via `@repo/kafka`, publishing
  `{ value: payload }` and reading `message.value` in handlers.
- Use Clerk for authentication; guard mutating routes with `shouldBeUser`/`shouldBeAdmin`.
- Read config from environment variables; document new keys in the workspace `.env.example`.
- Preserve TypeScript strictness (`noUncheckedIndexedAccess`, `isolatedModules`).
- Return structured `{ message }` errors in HTTP services; catch errors in Kafka handlers.

### 3. After Making Changes

- Run `pnpm check-types` across affected workspaces.
- Run `pnpm build` for Next.js apps (`admin`, `client`) and `payment-service`.
- Run `pnpm lint` for `admin` and `client`.
- Update relevant `AGENTS.md` and `docs/` files when contracts, architecture, or behavior change.

## Never

- Commit secrets or `.env` files, or edit `packages/product-db/generated/**`.
- Add direct HTTP calls between backend services.
- Weaken shared tsconfig/eslint configs or add `any` to bypass type errors.
- Claim tests pass — no test runner exists in this repo yet (see `docs/TESTING.md`).
