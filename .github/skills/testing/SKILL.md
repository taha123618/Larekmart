---
name: testing
description: Use when asked to test, verify, or add tests to Larekmart — including monorepo pnpm test, type checks, Go tests, Python tests, pricing, and schema test suites.
---

# Testing & Quality Assurance Guide — Larekmart

This skill provides the authoritative reference for running, authoring, and maintaining automated test suites and quality gates in the Larekmart monorepo.

---

## 1. Automated Test Architecture

The repository features a unified multi-runtime testing strategy orchestrated via Turborepo (`pnpm test`):

| Workspace                    | Technology / Framework      | Scope & Test Targets                                                                                                                                                                                                                                                                                                                      |
| :--------------------------- | :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@repo/types`**            | Node.js Test Runner / `tsx` | Domain contracts, Zod schemas, boundary validations (`tests/schemas.test.ts`)                                                                                                                                                                                                                                                             |
| **`user-service`**           | Node.js Test Runner / `tsx` | Profile/address/preferences service logic (`tests/user-service.test.ts`)                                                                                                                                                                                                                                                                  |
| **`order-service`**          | Node.js Test Runner / `tsx` | Order security and authorization (`tests/order-security.test.ts`)                                                                                                                                                                                                                                                                         |
| **`cart-service`**           | Node.js Test Runner / `tsx` | Pricing engine, promotional discounts, coupon rules, threshold boundaries (`tests/pricing.test.ts`)                                                                                                                                                                                                                                       |
| **`shipping-service`**       | Node.js Test Runner / `tsx` | Constant-time webhook verification, RBAC/M2M middleware, RS256 direct-token claims + expiry, carrier integration smoke test                                                                                                                                                                                                               |
| **`media-service`**          | Node.js Test Runner / `tsx` | Six offline suites via `tests/index.test.ts`: unit validation, storage contract, HTTP API, Kafka messaging, workers, integration schema, plus the full lifecycle suite (`tests/media-service.test.ts`) — object keys, magic bytes, authorization, URL strategy, worker claim SQL, index strategy, cleanup sweeps                          |
| **`review-service`**         | Node.js Test Runner / `tsx` | Five offline suites via `tests/index.test.ts`: domain unit validation, anti-abuse voting/reporting, Fastify API routes, Kafka messaging publishers & consumers, database schema & constraints (`tests/review-service.test.ts`)                                                                                                            |
| **`wishlist-service`**       | Node.js Test Runner / `tsx` | Nine suites via `tests/wishlist-service.test.ts`: health probes, auth guards, Zod contracts, default wishlist creation, item deduplication, named wishlists, item move, guest migration, and unguessable token shares                                                                                                                     |
| **`promotion-service`**      | Node.js Test Runner / `tsx` | Eleven suites via `tests/promotion-service.test.ts`: health probes, auth guards, campaign lifecycle, coupon validation, evaluation quotes, budget tracking, ACID reservations, commit/release, worker expiry, and event emission                                                                                                          |
| **`tax-service`**            | Node.js Test Runner / `tsx` | Nine suites via `tests/tax-service.test.ts`: health probes, auth guards, decimal arithmetic precision, standard rule evaluation, exemption certificate verification, calculation snapshot persistence, proportional return refunds, adapter factory, and event emission                                                                   |
| **`return-service`**         | Node.js Test Runner / `tsx` | Fourteen suites via `tests/return-service.test.ts`: health probes, auth guards, return policy evaluation, eligibility verification, evidence validation, state machine transitions, warehouse inspections, carrier reverse-shipping, decimal refund proration, outbox event persistence, and event emission                               |
| **`pricing-service`**        | Node.js Test Runner / `tsx` | Ten suites via `tests/pricing-service.test.ts`: decimal arithmetic precision, volume tiered pricing, currency conversion, negative price prevention, quote snapshot persistence, Fastify endpoints, and event emission                                                                                                                    |
| **`vendor-service`**         | Node.js Test Runner / `tsx` | Legal entity registration, KYB document verification, member access, status transitions, and lifecycle event emission (`tests/vendor-service.test.ts`)                                                                                                                                                                                    |
| **`seller-service`**         | Node.js Test Runner / `tsx` | Marketplace storefront profiles, multi-staff permissions, operational settings, metrics snapshots, and Fastify endpoints (`tests/seller-service.test.ts`)                                                                                                                                                                                 |
| **`seller`**                 | Vitest / Playwright         | Pinia stores, API error handling, utilities, UI components, and end-to-end multi-step merchant onboarding workflows (`tests/`)                                                                                                                                                                                                            |
| **`commission-service`**     | Node.js Test Runner / `tsx` | Tiered rate evaluation, Decimal.js financial precision, rule versioning, order fee calculation, quote snapshots, and event emission (`tests/commission-service.test.ts`)                                                                                                                                                                  |
| **`payout-service`**         | Node.js Test Runner / `tsx` | Append-only balanced double-entry ledger invariant tests (`SUM(debit) == SUM(credit)`), settlement batches, provider reconciliation, and seller balance queries (`tests/payout-service.test.ts`)                                                                                                                                          |
| **`fraud-service`**          | Pytest (`pytest`) via `uv`  | Real-time multi-entity risk scoring, Redis sliding-window velocity tracker, explainable rules, scikit-learn anomaly detection, analyst case reviews, and Kafka event stream processing (20 tests via `tests/`)                                                                                                                            |
| **`support-service`**        | Node.js Test Runner / `tsx` | Fourteen suites via `tests/tickets.test.ts` & `tests/sla-and-escalation.test.ts`: ticket creation, categories, auth guards, internal note redaction, agent reply transitions, SLA deadlines, assignments, escalations, and resolution analytics                                                                                           |
| **`chat-service`**           | Node.js Test Runner / `tsx` | Unit & integration test suites via `tests/unit/chat.unit.test.ts` & `tests/integration/chat.integration.test.ts`: timing-safe comparison, schema validation, buyer-to-seller threads, support tickets, paginated message feeds, attachments, unread counts, read receipts, message reporting, user blocking, and idempotency key handling |
| **`analytic-service`**       | Go Test Tool (`go test`)    | Config validation (production secret fail-closed), constant-time gateway auth, RS256/expiry token verification, lock-free atomic KPI store, bounded-channel micro-batching, and REST handlers (`cmd/...`, `internal/...`)                                                                                                                 |
| **`notification-service`**   | Go Test Tool (`go test`)    | Multi-channel dispatchers, templates, workers, WebSocket lifecycle/origin checks, RS256/expiry token verification, forged-token rejection, recovery (`internal/*`)                                                                                                                                                                        |
| **`recommendation-service`** | Pytest (`pytest`) via `uv`  | Hybrid recommendations, vector embeddings, algorithms, API endpoints (34 tests)                                                                                                                                                                                                                                                           |
| **`catalog-service`**        | Node.js Test Runner / `tsx` | Eight suites via `tests/catalog-service.test.ts`: key naming invariants, Fastify health probes, Prometheus metrics, projector contracts, PostgreSQL replica fallback, getCatalogDb consistency switching, Fastify RYW header hook, Redis session lease lifecycle, and cache bypass                                                        |
| **`api-gateway`**            | Node.js Test Runner / `tsx` | Eleven suites via `tests/index.test.ts`: route registry, dynamic circuit breaker, sliding-window metrics, rate limiting, request correlation, health endpoints, in-flight bulkheads, adaptive rate-limiting, edge inventory caching, and proxy security                                                                                   |
| **`@repo/redis`**            | Node.js Test Runner / `tsx` | Eight offline suites via `tests/redis-cluster-sharding.test.ts`: CRC16 hash tag calculation, cross-slot alignment assertions, Redlock 3-node consensus simulation, distributed leader elector with fencing tokens, atomic cluster locking, and Read-Your-Writes consistency leases                                                        |

---

## 2. Test Execution Commands

```bash
# 1. Run all automated test suites across the monorepo (Turbo pipeline)
pnpm test

# 2. Run Dynamic Application Security Testing (DAST) across ingress & perimeter
pnpm test:dast

# 3. Run high-throughput flash-sale load benchmarks (k6)
./infrastructure/load-tests/seed-flash-sale.sh
./infrastructure/load-tests/run-flash-sale.sh

# 4. Run Playwright End-to-End (E2E) browser flows
pnpm --filter @repo/e2e test

# 5. Run tests for a specific workspace
pnpm --filter @repo/types test
pnpm --filter @repo/redis test
pnpm --filter @repo/kafka test
pnpm --filter @repo/monitoring test
pnpm --filter api-gateway test
pnpm --filter catalog-service test
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
pnpm --filter seller test
pnpm --filter commission-service test
pnpm --filter payout-service test
pnpm --filter fraud-service test
pnpm --filter support-service test
pnpm --filter chat-service test
pnpm --filter analytic-service test
pnpm --filter notification-service test
pnpm --filter recommendation-service test

# 6. Static type-check across all 47 packages
pnpm check-types

# 7. Monorepo code style and formatting checks
pnpm format:check

# 8. Frontend linting (Next.js client, admin, and seller)
pnpm lint

# 9. Production builds
pnpm build
```

---

## 3. SQA Testing Standards (The 15 Quality Pillars)

When adding or updating features, tests must cover the full 15-pillar quality spectrum:

### Pillar 1: Unit Testing

- Test pure functions, calculation helpers, Decimal.js financial math, state machines, and data mappers in isolation.
- Zero external network or database calls. Test execution must be sub-second and 100% deterministic.

### Pillar 2: Integration Testing

- Test multi-component interactions: Fastify/Express routes coupled with real/mocked Prisma models, MongoDB Mongoose connections, Redis caching, and Kafka events.
- Verify transactional rollback semantics on failures.

### Pillar 3: API & Backend Testing

- Thoroughly test all API endpoints: authentication requirements, RBAC permissions, request body validation (Zod schemas), response schemas, pagination, and HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`).
- Verify that non-admin callers cannot access privileged administrative routes.

### Pillar 4: End-to-End (E2E) Browser Testing (Playwright)

- Test end-to-end customer and merchant journeys across Chromium, Firefox, and WebKit (`packages/e2e`):
  - Customer checkout flow with Stripe test card.
  - Guest cart persistence in localStorage across page reloads.
  - Product search, category filtering, and product detail navigation.
  - Seller order management view and dashboard authentication.

### Pillar 5: Frontend Component Testing

- Test React 19 / Next.js 16 and Vue 3 / Nuxt 3 components:
  - Page rendering, loading states, empty states, error boundaries (`error.tsx`), and retry actions.
  - Form validation, disabled button states during submission, and responsive layouts.
  - Hydration safety: verify zero SSR hydration mismatches (`isMounted` guards on local stores).

### Pillar 6: Database Testing

- Verify schema migrations, foreign key constraints, indexes, unique constraints, and transaction atomicity.
- Assert zero unparameterized SQL queries monorepo-wide.

### Pillar 7: Authentication & Authorization Testing

- Cryptographic verification of Clerk JWT tokens (RS256).
- Test expired tokens (`exp`), premature tokens (`nbf`), forged tokens, and role elevation attempts.
- Verify IDOR prevention: non-owners receive `403 Forbidden` when attempting to access or modify resources belonging to another user.

### Pillar 8: Validation & Error-Handling Testing

- Assert that invalid payloads (missing fields, wrong types, negative quantities, oversized strings) are rejected with structured error messages.
- Test boundary clamping: coupon discounts cannot exceed cart subtotal; quantities cannot be negative.

### Pillar 9: Security Testing (DAST)

- Run automated Dynamic Application Security Testing (`pnpm test:dast`).
- Verify perimeter header sanitization: untrusted caller headers (`x-user-id`, `x-user-role`, `x-internal-secret`) are stripped on ingress.
- Verify constant-time comparison on webhook signatures and internal secrets.

### Pillar 10: Performance & Load Testing (k6 Flash-Sale)

- Benchmark high-concurrency scenarios using k6 scripts (`infrastructure/load-tests/`):
  - Redis Lua stock gatekeeper rejects exhausted inventory in `< 10ms` in-memory.
  - Zero-DB HMAC-SHA256 price quote validation completes in `< 35ms`.
  - Zero-oversell invariant maintained under concurrent purchase attempts.

### Pillar 11: Edge-Case & Negative Testing

- Test unusual inputs: null bytes, emojis, Unicode strings, zero quantities, empty carts, concurrent duplicate submissions.

### Pillar 12: Regression Testing

- Ensure automated regression tests exist for every historical bug (BUG-01 through BUG-08) to prevent defect re-emergence.

### Pillar 13: Responsive & Cross-Browser Testing

- Verify mobile viewport boundaries (`min-w-0 max-w-full`) and horizontal table scroll containers preventing viewport blowout on small screens.

### Pillar 14: Real-Time & WebSocket Testing

- Test Socket.IO connection handshakes, cryptographic Bearer token authentication, presence tracking, and Redis Pub/Sub multi-pod broadcast synchronization.

### Pillar 15: Queue & Background-Job Testing

- Test Kafka transactional outbox event creation, outbox relay polling, consumer batching (`subscribeBatch`), and DLQ poison-pill isolation.

---

## 4. Defect Tracking & Severity Classification Protocol

When defects are discovered during SQA analysis or test execution, classify and document them using this standardized severity matrix:

| Severity     | Definition                                                                                       | Operational Impact                                         | Action Required                                   |
| :----------- | :----------------------------------------------------------------------------------------------- | :--------------------------------------------------------- | :------------------------------------------------ |
| **Critical** | Data corruption, financial loss, zero-day security bypass, authentication bypass, platform crash | Checkout broken, stock oversold, unauthorized admin access | Block release immediately. Hotfix before merging. |
| **High**     | Core feature failure with no workaround, major performance degradation, data leakage             | Cart checkout fails intermittently, order saga stalled     | Prioritize fix before general release.            |
| **Medium**   | Non-critical feature bug, minor UI inconsistency, edge-case validation missing                   | Filter button unresponsive, missing empty state            | Fix in current milestone sprint.                  |
| **Low**      | Minor cosmetic defect, typos in logs/messages, documentation inconsistency                       | Button alignment on mobile, non-blocking warning log       | Address during routine maintenance.               |

### Bug Documentation Format

Every reported defect must include:

1. **Defect ID & Title** (e.g. `BUG-09: Unbounded pagination query in orders list`)
2. **Severity & Priority**
3. **Affected Workspace & Component**
4. **Steps to Reproduce**
5. **Expected Behavior vs Actual Behavior**
6. **Root Cause Analysis**
7. **Remediation & Automated Regression Test**

---

## 5. Pre-PR / Pre-Merge Quality Checklist (Definition of Done)

Before submitting or merging code changes:

- [ ] `pnpm test` passes across all target workspaces (100% pass rate).
- [ ] `pnpm test:dast` passes all OWASP API Security Top 10 attack vectors.
- [ ] `pnpm check-types` reports 0 TypeScript errors across all 47 packages.
- [ ] `pnpm format:check` confirms all files conform to Prettier style.
- [ ] `pnpm lint` reports 0 errors in Next.js and Nuxt 3 applications.
- [ ] Zero unparameterized SQL queries (no raw string interpolations in DB queries).
- [ ] Negative and boundary test cases are included for any new business logic.
- [ ] Independent test fixtures with clean teardown (zero database pollution).
