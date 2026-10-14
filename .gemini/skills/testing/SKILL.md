---
name: testing
description: Use when asked to test, verify, or add tests to Larekmart — including monorepo pnpm test, type checks, Go tests, Python tests, pricing, and schema test suites.
---

# Testing & Quality Assurance Guide — Larekmart

This skill provides the authoritative reference for running, authoring, and maintaining automated test suites and quality gates in the Larekmart monorepo.

---

## 1. Automated Test Architecture

The repository features a unified multi-runtime testing strategy orchestrated via Turborepo (`pnpm test`):

| Workspace                    | Technology / Framework      | Scope & Test Targets                                                                                                                                                                                                                                                                                             |
| :--------------------------- | :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@repo/types`**            | Node.js Test Runner / `tsx` | Domain contracts, Zod schemas, boundary validations (`tests/schemas.test.ts`)                                                                                                                                                                                                                                    |
| **`user-service`**           | Node.js Test Runner / `tsx` | Profile/address/preferences service logic (`tests/user-service.test.ts`)                                                                                                                                                                                                                                         |
| **`order-service`**          | Node.js Test Runner / `tsx` | Order security and authorization (`tests/order-security.test.ts`)                                                                                                                                                                                                                                                |
| **`cart-service`**           | Node.js Test Runner / `tsx` | Pricing engine, promotional discounts, coupon rules, threshold boundaries (`tests/pricing.test.ts`)                                                                                                                                                                                                              |
| **`shipping-service`**       | Node.js Test Runner / `tsx` | Constant-time webhook verification, RBAC middleware, carrier integration smoke test                                                                                                                                                                                                                              |
| **`media-service`**          | Node.js Test Runner / `tsx` | Six offline suites via `tests/index.test.ts`: unit validation, storage contract, HTTP API, Kafka messaging, workers, integration schema, plus the full lifecycle suite (`tests/media-service.test.ts`) — object keys, magic bytes, authorization, URL strategy, worker claim SQL, index strategy, cleanup sweeps |
| **`review-service`**         | Node.js Test Runner / `tsx` | Five offline suites via `tests/index.test.ts`: domain unit validation, anti-abuse voting/reporting, Fastify API routes, Kafka messaging publishers & consumers, database schema & constraints (`tests/review-service.test.ts`)                                                                                   |
| **`notification-service`**   | Go Test Tool (`go test`)    | Multi-channel dispatchers, templates, workers, WebSocket lifecycle, recovery (`internal/*`)                                                                                                                                                                                                                      |
| **`recommendation-service`** | Pytest (`pytest`) via `uv`  | Hybrid recommendations, vector embeddings, algorithms, API endpoints (34 tests)                                                                                                                                                                                                                                  |
| **`@repo/redis`**            | Integration Verifier        | Key namespacing, cache TTLs, rate limiter, degraded resilience (`src/scripts/verify-redis.ts`)                                                                                                                                                                                                                   |

---

## 2. Test Execution Commands

```bash
# 1. Run all automated test suites across the monorepo (Turbo pipeline)
pnpm test

# 2. Run tests for a specific workspace
pnpm --filter @repo/types test
pnpm --filter user-service test
pnpm --filter order-service test
pnpm --filter cart-service test
pnpm --filter shipping-service test
pnpm --filter media-service test
pnpm --filter review-service test
pnpm --filter notification-service test
pnpm --filter recommendation-service test

# 3. Static type-check across all 31 workspaces
pnpm check-types

# 4. Monorepo code style and formatting checks
pnpm format:check

# 5. Frontend linting (Next.js client and admin)
pnpm lint

# 6. Production builds
pnpm build
```

---

## 3. SQA Testing Standards

When adding or updating tests, adhere to these quality engineering principles:

### A. Boundary & Edge-Case Testing

- Always test positive (valid inputs), negative (malformed, empty, out-of-range), and boundary values (e.g., exactly 2999 vs 3000 PKR for shipping fee thresholds).
- Test state-machine lifecycle transitions (e.g., `PENDING` -> `OUT_FOR_DELIVERY` -> `DELIVERED`).

### B. Isolation & Determinism

- Unit tests must never depend on live external network connections (e.g., Stripe API, live Clerk network, active carrier APIs).
- Mock or stub network I/O; integration checks requiring real backing containers must be opt-in and self-cleaning.

### C. Financial & Security Accuracy

- Pricing calculations must prevent negative subtotals or grand totals. Discounts must clamp to the subtotal.
- Cryptographic comparisons (signatures, digests) must be verified using constant-time algorithms (`crypto.timingSafeEqual`).
- Endpoint access control tests must verify that non-admin and unauthenticated requests receive `401` or `403`.

---

## 4. Pre-PR / Pre-Merge Quality Checklist

Before submitting code changes:

- [ ] `pnpm test` passes across all target workspaces.
- [ ] `pnpm check-types` reports 0 TypeScript errors across 31 workspaces.
- [ ] Test files are strict-mode clean: tsconfig `include` covers `src/` only, so
      `pnpm check-types` does not typecheck tests — run
      `npx tsc --noEmit --strict tests/<file>.ts` directly when hardening a test file,
      and never weaken assertions to make a test pass (no `.catch(() => undefined)`
      swallowing, no asserting tautologies on local test data).
- [ ] `pnpm format:check` confirms all files conform to Prettier style.
- [ ] `pnpm lint` reports 0 errors in Next.js applications.
- [ ] Negative and boundary test cases are included for any new business logic.
