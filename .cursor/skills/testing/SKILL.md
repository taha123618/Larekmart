---
name: testing
description: Use when asked to test, verify, or add tests to Larekmart — including type-check/build/manual verification, Go tests, Redis integration checks, and conventions for introducing a JavaScript test runner.
---

# Testing

## Current Reality

- **No general JavaScript test runner is configured** today — there is no Jest, Vitest, or Playwright suite. `notification-service` has Go tests and `@repo/redis` has an opt-in real-server integration check.
- **No CI/CD pipeline exists** in `.github/workflows`.
- Verification relies on compiler type safety, production builds, linting, and manual testing.

## Verification Commands

```bash
# Monorepo-wide typecheck (all 21 workspaces)
pnpm check-types

# Production builds (configured workspaces, including Next.js, search, payment, and Go notification service)
pnpm --filter admin build
pnpm --filter client build
pnpm --filter payment-service build
pnpm --filter search-service build
pnpm --filter notification-service build

# Infrastructure integration check
pnpm --filter @repo/redis verify:redis

# Linting (admin and client)
pnpm lint
```

## Minimum Verification by Change Area

| Change Area                         | Verification Step                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| Contracts & Schemas (`@repo/types`) | `pnpm check-types` from repository root                                           |
| Service Routes & Handlers           | `pnpm --filter <service> check-types` + manual endpoint verification              |
| Kafka Producers & Consumers         | `pnpm check-types` + observe topic delivery in Kafka UI (`http://localhost:8080`) |
| Next.js Pages & Components          | `pnpm --filter <app> check-types` + `pnpm --filter <app> build`                   |
| Database Schemas (Prisma)           | `pnpm --filter @repo/product-db db:generate` then `pnpm check-types`              |

## Introducing Automated Tests

When introducing tests, follow [`docs/TESTING.md`](../../docs/TESTING.md):

1. Use **Vitest** for new JavaScript/TypeScript unit and integration testing. Keep using the native Go test tool for `notification-service` and the dedicated Redis verifier for Redis behavior.
2. Add a `"test": "vitest run"` script to the target workspace and configure the `test` task in `turbo.json`.
3. Co-locate test files alongside code as `*.test.ts`.
4. Mock external network services (Stripe, Clerk, Kafka brokers, databases) in unit tests.
