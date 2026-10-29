# Testing Guide

This document outlines the testing strategy, current verification mechanisms, and standards for introducing automated tests to Larekmart.

## Automated Testing Strategy

Larekmart features a unified multi-runtime testing strategy orchestrated via Turborepo (`pnpm test`):

1. **Automated Unit & Integration Test Suites (27 Workspaces in `pnpm test`)**:
   - `@repo/types`: Domain contracts and Zod schema validations (`pnpm --filter @repo/types test`).
   - `@repo/kafka`: Dead-letter queue (DLQ) routing, poison-pill fast-failing, and exponential backoff retries (`pnpm --filter @repo/kafka test`).
   - `@repo/redis`: Cluster sharding, CRC16 slot pinning, 3-node Redlock consensus, distributed leader election, and `withClusterLock` wrappers (`pnpm --filter @repo/redis test`).
   - `api-gateway`: Route registry, circuit breaker state machine, SingleFlight coalescing, in-flight concurrency bulkheads, and adaptive rate-limiting guardrails (`pnpm --filter api-gateway test`).
   - `product-service`: Auth guards (user, seller, admin), Clerk token claims, Kafka event payloads (`toProductEventPayload`), and ProductFormSchema (`pnpm --filter product-service test`).
   - `order-service`: Order security, Multi-DB Dual-ACK Saga orchestrator, Transactional Outbox sweeper, MongoDB hashed sharding, idempotency, and chaos resilience rollback suite (`pnpm --filter order-service test`).
   - `payment-service`: Hono auth middleware, gateway header propagation, Stripe webhook signature failure handling, and `PaymentSuccessfulType` event schema (`pnpm --filter payment-service test`).
   - `auth-service`: Clerk express integration, user/admin guards, `UserFormSchema`, and user lifecycle events (`pnpm --filter auth-service test`).
   - `analytic-service`: Express auth guards, real-time KPI metrics snapshot calculations, and merchant event aggregation (`pnpm --filter analytic-service test`).
   - `search-service`: Fastify auth guards, OpenSearch payload validation, `BulkIndexRequestSchema`, and reindex parameters (`pnpm --filter search-service test`).
   - `inventory-service`: Stripe session verification regression guard, Hono auth middleware, multi-warehouse cache aggregation, Redis stock gatekeeper, and reservation schemas (`pnpm --filter inventory-service test`).
   - `catalog-service`: Read-model cache key formatting, Fastify health/readiness/metrics route injection, product projection payloads, and PostgreSQL read-replica routing (`pnpm --filter catalog-service test`).
   - `cart-service`: Financial pricing engine, discount calculators, cart expiration worker cluster lock, and threshold boundary tests (`pnpm --filter cart-service test`).
   - `shipping-service`: Constant-time webhook verification and authorization middleware tests (`pnpm --filter shipping-service test`).
   - `user-service`: Profile, address, and account-domain service tests (`pnpm --filter user-service test`).
   - `media-service`: Six offline suites covering object-key traversal safety, magic-byte MIME detection, size limits, cross-owner authorization, and cleanup sweeps (`pnpm --filter media-service test`).
   - `review-service`: Product reviews, rating calculations, verified purchases, anti-abuse voting, and moderation tests (`pnpm --filter review-service test`).
   - `wishlist-service`: Wishlist operations, item deduplication, guest-to-user migration, token shares, price drop and restock alert tests (`pnpm --filter wishlist-service test`).
   - `promotion-service`: Eleven suites covering campaign lifecycle, coupon codes, evaluation quotes, budget tracking, ACID reservations, worker sweeps, and event emission (`pnpm --filter promotion-service test`).
   - `tax-service`: Nine suites covering health probes, auth guards, decimal arithmetic precision, standard rule evaluation, exemption certificate verification, and proportional return refunds (`pnpm --filter tax-service test`).
   - `return-service`: Fourteen suites covering return eligibility, 14-day return window validation, partial quantities, evidence validation, state machine transitions, and refund proration (`pnpm --filter return-service test`).
   - `pricing-service`: Ten suites covering decimal financial precision, volume tiered pricing, multi-currency conversion, negative price prevention, and quote snapshot persistence (`pnpm --filter pricing-service test`).
   - `vendor-service`: Legal entity registration, KYB document verification, member access, status transitions, and lifecycle event emission (`pnpm --filter vendor-service test`).
   - `seller-service`: Marketplace storefront profiles, multi-staff permissions, operational settings, metrics snapshots, and Fastify endpoints (`pnpm --filter seller-service test`).
   - `email-service`: Email template interpolation for user signups, order receipts with tax breakdown, KYB notifications, and storefront lifecycle alerts (`pnpm --filter email-service test`).
   - `notification-service`: Native Go test suite for workers, templates, dispatchers, and WebSockets (`go test ./...`).
   - `recommendation-service`: Python test suite with 34 tests covering hybrid algorithms and API endpoints (`uv run pytest tests/`).


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
