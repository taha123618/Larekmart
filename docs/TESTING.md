# Testing Guide

This document outlines the testing strategy, current verification mechanisms, and standards for introducing automated tests to Larekmart.

## Automated Testing Strategy

Larekmart features a unified multi-runtime testing strategy orchestrated via Turborepo (`pnpm test`):

1. **Automated Unit & Integration Test Suites**:
   - `@repo/types`: Domain contracts and Zod schema validations (`pnpm --filter @repo/types test`).
   - `user-service`: Profile, address, and account-domain service tests (`pnpm --filter user-service test`).
   - `order-service`: Order security and authorization tests (`pnpm --filter order-service test`).
   - `cart-service`: Financial pricing engine, discount calculators, and threshold boundary tests (`pnpm --filter cart-service test`).
   - `shipping-service`: Constant-time webhook verification and authorization middleware tests (`pnpm --filter shipping-service test`).
   - `media-service`: Six offline suites (unit validation, storage, API, messaging, workers, and a full lifecycle suite) covering object-key traversal safety, magic-byte MIME detection, per-category size limits, cross-owner authorization, private-media visibility, URL strategy, worker claim SQL, index strategy, and cleanup sweeps (`pnpm --filter media-service test`).
   - `review-service`: Product reviews, rating calculations, verified purchases, anti-abuse voting, and moderation tests (`pnpm --filter review-service test`).
   - `wishlist-service`: Wishlist operations, item deduplication, guest-to-user migration, token shares, price drop and restock alert tests (`pnpm --filter wishlist-service test`).
   - `promotion-service`: Eleven suites covering campaign lifecycle, coupon codes, evaluation quotes, budget tracking, ACID reservations, worker sweeps, and event emission (`pnpm --filter promotion-service test`).
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

- **The established convention is standalone tsx-run test files**: a `tests/` directory
  per workspace whose `test` script executes the suite entrypoint directly, e.g.
  `"test": "tsx tests/index.test.ts"` (media-service) or
  `"test": "tsx tests/pricing.test.ts"` (cart-service). Suites use `node:assert/strict`,
  keep their own pass/fail counting, and exit non-zero on failure so Turbo reports them.
  There is **no Vitest or Jest anywhere in the monorepo** — do not add a new runner to a
  workspace that already has one of these suites.
- **Go services** use `go test ./...`; the Python service uses pytest via `uv`.
- **Important gap:** tsconfig `include` covers `src/` only, so `pnpm check-types` does
  **not** typecheck test files. Keep test code strict-clean by hand, and when hardening a
  test file run strict tsc on it directly:
  `npx tsc --noEmit --strict --noUncheckedIndexedAccess tests/<file>.ts` (from the workspace root).

### 2. Unit Testing Layer

- **Location**: A `tests/` directory in the workspace (the established convention), with suite files named by domain (e.g. `tests/media-service.test.ts`, `tests/pricing.test.ts`).
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

To introduce tests to a workspace that has none yet:

1. Create a `tests/` directory and follow the existing file conventions (see
   `apps/media-service/tests/index.test.ts` for the composition-root pattern and
   `tests/media-service.test.ts` for the in-file runner).
2. Add a test script in `apps/<workspace>/package.json`:
   ```json
   "scripts": {
     "test": "tsx tests/index.test.ts"
   }
   ```
3. The `test` task is already registered in `turbo.json`, so `pnpm test` picks it up
   automatically; ensure `tsx` is a devDependency of the workspace.
