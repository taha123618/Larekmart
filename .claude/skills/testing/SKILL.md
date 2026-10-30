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
| **`wishlist-service`**       | Node.js Test Runner / `tsx` | Nine suites via `tests/wishlist-service.test.ts`: health probes, auth guards, Zod contracts, default wishlist creation, item deduplication, named wishlists, item move, guest migration, and unguessable token shares                                                                                            |
| **`promotion-service`**      | Node.js Test Runner / `tsx` | Eleven suites via `tests/promotion-service.test.ts`: health probes, auth guards, campaign lifecycle, coupon validation, evaluation quotes, budget tracking, ACID reservations, commit/release, worker expiry, and event emission                                                                                 |
| **`tax-service`**            | Node.js Test Runner / `tsx` | Nine suites via `tests/tax-service.test.ts`: health probes, auth guards, decimal arithmetic precision, standard rule evaluation, exemption certificate verification, calculation snapshot persistence, proportional return refunds, adapter factory, and event emission                                          |
| **`return-service`**         | Node.js Test Runner / `tsx` | Fourteen suites via `tests/return-service.test.ts`: health probes, auth guards, return policy evaluation, eligibility verification, evidence validation, state machine transitions, warehouse inspections, carrier reverse-shipping, decimal refund proration, outbox event persistence, and event emission      |
| **`pricing-service`**        | Node.js Test Runner / `tsx` | Ten suites via `tests/pricing-service.test.ts`: decimal arithmetic precision, volume tiered pricing, currency conversion, negative price prevention, quote snapshot persistence, Fastify endpoints, and event emission                                                                                           |
| **`vendor-service`**         | Node.js Test Runner / `tsx` | Legal entity registration, KYB document verification, member access, status transitions, and lifecycle event emission (`tests/vendor-service.test.ts`)                                                                                                                                                           |
| **`seller-service`**         | Node.js Test Runner / `tsx` | Marketplace storefront profiles, multi-staff permissions, operational settings, metrics snapshots, and Fastify endpoints (`tests/seller-service.test.ts`)                                                                                                                                                        |
| **`analytic-service`**       | Go Test Tool (`go test`)    | Config validation, constant-time auth guards, lock-free atomic KPI store, bounded-channel micro-batching, and REST handlers (`cmd/...`, `internal/...`)                                                                                                                                                          |
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
pnpm --filter wishlist-service test
pnpm --filter promotion-service test
pnpm --filter tax-service test
pnpm --filter return-service test
pnpm --filter pricing-service test
pnpm --filter vendor-service test
pnpm --filter seller-service test
pnpm --filter analytic-service test
pnpm --filter notification-service test
pnpm --filter recommendation-service test

# 3. Static type-check across all 39 workspaces
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
- [ ] `pnpm check-types` reports 0 TypeScript errors across 33 workspaces.
- [ ] Test files are strict-mode clean: tsconfig `include` covers `src/` only, so
      `pnpm check-types` does not typecheck tests — run
      `npx tsc --noEmit --strict tests/<file>.ts` directly when hardening a test file,
      and never weaken assertions to make a test pass (no `.catch(() => undefined)`
      swallowing, no asserting tautologies on local test data).
- [ ] `pnpm format:check` confirms all files conform to Prettier style.
- [ ] `pnpm lint` reports 0 errors in Next.js applications.
- [ ] Negative and boundary test cases are included for any new business logic.
