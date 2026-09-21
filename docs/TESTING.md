# Testing Guide

This document outlines the testing strategy, current verification mechanisms, and standards for introducing automated tests to Larekmart.

## Current Testing Reality

The repository does not have a general JavaScript test runner configured (no Jest, Vitest, or Playwright suite). It does have Go unit tests in `notification-service` and an opt-in real-Redis integration verifier. Verification relies on:

1. **Strict TypeScript Compilation**:
   ```bash
   pnpm check-types
   ```
2. **Production Build Validation**:
   ```bash
   pnpm build
   ```
3. **Static Linting**:
   ```bash
   pnpm lint
   ```
4. **Manual & Integration Verification**:
   Testing end-to-end user flows against local services, Kafka UI (`http://localhost:8080`), PostgreSQL, MongoDB, Redis, and OpenSearch.

## Testing Strategy & Standards

When writing automated tests in Larekmart, adhere to the following architecture:

### 1. Recommended Test Runner

- **Vitest** is the standard test runner for this monorepo due to native ESM support, rapid execution, and TypeScript integration.

### 2. Unit Testing Layer

- **Location**: Co-located with implementation files (`foo.test.ts` next to `foo.ts`).
- **Scope**:
  - Zod validation schemas in `@repo/types`.
  - Utility functions and calculation logic.
  - State reducers and store actions (e.g. Zustand cart store).
  - Kafka message serialization and deserialization helpers.
- **Mocking**: External services (Stripe API, Clerk SDK, live Kafka brokers, database connections) MUST be mocked in unit tests.

### 3. Integration Testing Layer

- Test HTTP route handlers and Kafka message processing using in-memory or containerized dependencies.
- Keep integration tests isolated and opt-in so they do not break standard offline `pnpm check-types`.
- **Checks that exist today:** `notification-service` ships `pnpm --filter notification-service test` plus an
  opt-in migration check (`NOTIFICATION_DB_TEST_URL="$DATABASE_URL" go test ./internal/db/ -run Integration -v`)
  that applies the embedded migrations to a real database and asserts they are recorded in
  `schema_migrations` exactly once, and `@repo/redis` ships `pnpm --filter @repo/redis verify:redis`
  (`packages/redis/src/scripts/verify-redis.ts`), which asserts key namespacing, cache TTLs, the
  three read outcomes (`hit` / `miss` / `error`, so a Redis outage is never counted as a cold cache),
  the namespace-version bump, the rate limiter, and degraded behaviour against a real Redis. It needs
  `docker compose -f packages/redis/docker-compose.yml up -d`, writes only under a run-scoped key
  prefix, cleans up after itself, and exits non-zero on failure.
- Follow that shape for new integration checks: a script under `src/` (so `pnpm check-types`
  covers it), opt-in, isolated from a shared dependency, self-cleaning, and non-zero on failure.

### 4. End-to-End (E2E) Testing Layer

- **Playwright** is recommended for cross-browser testing of customer checkout and admin dashboard flows.

## Adding Tests to a Workspace

To introduce tests to a workspace:

1. Add `vitest` as a devDependency in the target workspace:
   ```bash
   pnpm add -D vitest --filter <workspace>
   ```
2. Add a test script in `apps/<workspace>/package.json`:
   ```json
   "scripts": {
     "test": "vitest run"
   }
   ```
3. Register the `test` task in `turbo.json`:
   ```json
   "tasks": {
     "test": {
       "dependsOn": ["^build"]
     }
   }
   ```
