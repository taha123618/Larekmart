# Testing Guide

This document outlines the testing strategy, current verification mechanisms, and standards for introducing automated tests to Larekmart.

## Automated Testing Strategy

Larekmart features a unified multi-runtime testing strategy orchestrated via Turborepo (`pnpm test`):

1. **Automated Unit & Integration Test Suites**:
   - `@repo/types`: Domain contracts and Zod schema validations (`pnpm --filter @repo/types test`).
   - `cart-service`: Financial pricing engine, discount calculators, and threshold boundary tests (`pnpm --filter cart-service test`).
   - `shipping-service`: Constant-time webhook verification and authorization middleware tests (`pnpm --filter shipping-service test`).
   - `notification-service`: Native Go test suite for workers, templates, dispatchers, and WebSockets (`go test ./...`).
   - `recommendation-service`: Python test suite with 34 tests covering hybrid algorithms and API endpoints (`uv run pytest tests/`).
   - `@repo/redis`: Opt-in Redis integration verifier (`pnpm --filter @repo/redis verify:redis`).

2. **Strict TypeScript Compilation**:
   ```bash
   pnpm check-types
   ```
3. **Production Build Validation**:
   ```bash
   pnpm build
   ```
4. **Code Quality & Formatting**:
   ```bash
   pnpm format:check
   pnpm lint
   ```

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
