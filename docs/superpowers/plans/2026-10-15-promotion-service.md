# Promotion Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a centralized promotion engine for campaigns, coupon codes, discounts, promotional budgets, and reservation/redemption tracking in the Larekmart marketplace.

**Architecture:** Built on Hono 4 running on Node.js 22 LTS, backed by PostgreSQL (`larekmart_promotion_db`) via Drizzle ORM for authoritative ACID redemptions and budgets, Redis for rate limiting and active coupon fast lookups, and Apache Kafka for asynchronous order/product event integration.

**Tech Stack:** Hono 4, Node.js 22, TypeScript 5, Drizzle ORM, PostgreSQL, Redis (ioredis), Apache Kafka (kafkajs), Zod, Prometheus, Pino (@repo/monitoring).

**Spec:** User specification for `promotion-service` (coupons, campaigns, discount eligibility, usage limits, reservations, and redemptions).

## Global Constraints

- Monorepo package manager: pnpm 9 with Turborepo filters.
- Runtime & language: Node.js 22 LTS, ESM modules (`"type": "module"`), TypeScript strict.
- Authoritative DB: PostgreSQL `larekmart_promotion_db` on port 5432 using Drizzle ORM.
- Redis namespace: `promotion:v1:*` for coupon fast-check and short-lived locks.
- Kafka envelope: `producer.send(topic, { value: payload })` and handlers read `message.value`.
- Service port: `8016` (internal container / microservice port).
- Auth: Clerk JWT validation (`shouldBeUser`, `shouldBeAdmin`, `optionalUserOrGuest`).
- Shared types and schemas live in `@repo/types`.

---

### Task 1: Shared Domain Contracts & Kafka Topics

**Files:**

- Create: `packages/types/src/promotion.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `packages/kafka/src/init-topics.ts`

**Interfaces:**

- Produces: `Promotion`, `PromotionRule`, `PromotionTarget`, `CouponCode`, `PromotionReservation`, `PromotionRedemption`, `PromotionBudget`, `PromotionAuditLog`, `ValidateCouponInput`, `PromotionQuoteInput`, `PromotionQuoteResponse`, `CreateReservationInput`, `CommitReservationInput`, `ReleaseReservationInput`, `CreatePromotionInput`, `CreateCouponInput`.
- Kafka Event Payloads: `PromotionCreatedEvent`, `PromotionActivatedEvent`, `PromotionDeactivatedEvent`, `PromotionReservedEvent`, `PromotionRedeemedEvent`, `PromotionReservationReleasedEvent`, `PromotionBudgetExhaustedEvent`.

- [ ] **Step 1: Define promotion Zod schemas and TypeScript types in `@repo/types`**
- [ ] **Step 2: Export promotion contracts from `packages/types/src/index.ts`**
- [ ] **Step 3: Register 7 promotion Kafka topics in `packages/kafka/src/init-topics.ts`**
- [ ] **Step 4: Type-check affected packages (`pnpm --filter @repo/types check-types` and `pnpm --filter @repo/kafka check-types`)**
- [ ] **Step 5: Commit Task 1**

---

### Task 2: Service Scaffolding, Drizzle Schema & Idempotent Migrations

**Files:**

- Create: `apps/promotion-service/package.json`
- Create: `apps/promotion-service/tsconfig.json`
- Create: `apps/promotion-service/drizzle.config.ts`
- Create: `apps/promotion-service/.env.example`
- Create: `apps/promotion-service/.env`
- Create: `apps/promotion-service/src/config/env.ts`
- Create: `apps/promotion-service/src/db/schema.ts`
- Create: `apps/promotion-service/src/db/connection.ts`
- Create: `apps/promotion-service/src/db/migrate.ts`

**Interfaces:**

- Database Tables:
  - `promotions`: `id` (UUID pk), `name`, `description`, `status` (DRAFT, SCHEDULED, ACTIVE, PAUSED, EXPIRED, DEACTIVATED), `type` (PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING), `discount_value`, `max_discount_amount`, `start_date`, `end_date`, `priority`, `is_stackable`, `created_at`, `updated_at`.
  - `promotion_rules`: `id` (UUID pk), `promotion_id` (fk), `min_order_amount`, `customer_segment` (ALL, FIRST_TIME, VIP), `max_per_customer`, `global_limit`, `usage_count`.
  - `promotion_targets`: `id` (UUID pk), `promotion_id` (fk), `target_type` (PRODUCT, CATEGORY, SELLER, ORDER), `target_id`, `rule_type` (INCLUDE, EXCLUDE).
  - `coupon_codes`: `id` (UUID pk), `code` (unique text), `promotion_id` (fk), `max_redemptions`, `redemptions_count`, `is_active`, `expires_at`.
  - `promotion_reservations`: `id` (UUID pk), `promotion_id` (fk), `coupon_id` (fk nullable), `user_id`, `guest_id`, `order_id`, `discount_amount`, `status` (RESERVED, COMMITTED, RELEASED, EXPIRED), `expires_at`, `created_at`.
  - `promotion_redemptions`: `id` (UUID pk), `promotion_id` (fk), `coupon_id` (fk nullable), `reservation_id` (fk nullable), `user_id`, `order_id`, `discount_amount`, `redeemed_at`.
  - `promotion_budgets`: `id` (UUID pk), `promotion_id` (fk unique), `total_budget`, `reserved_amount`, `spent_amount`, `currency`.
  - `promotion_audit_logs`: `id` (UUID pk), `entity_type`, `entity_id`, `action`, `performed_by`, `metadata`, `created_at`.

- [ ] **Step 1: Initialize workspace configuration and dependencies for `apps/promotion-service`**
- [ ] **Step 2: Implement Drizzle ORM schema with relationships and composite indexes**
- [ ] **Step 3: Implement PostgreSQL pool connection and migration runner (`src/db/migrate.ts`)**
- [ ] **Step 4: Execute database migration against `larekmart_promotion_db` and verify tables**
- [ ] **Step 5: Commit Task 2**

---

### Task 3: Data Access Repositories with Atomic ACID Constraints

**Files:**

- Create: `apps/promotion-service/src/repositories/promotion.repository.ts`
- Create: `apps/promotion-service/src/repositories/coupon.repository.ts`
- Create: `apps/promotion-service/src/repositories/reservation.repository.ts`
- Create: `apps/promotion-service/src/repositories/budget.repository.ts`

**Interfaces:**

- `PromotionRepository`: `create()`, `findById()`, `listActive()`, `updateStatus()`, `recordAudit()`
- `CouponRepository`: `findByCode()`, `createCoupon()`, `incrementUsage()`, `decrementUsage()`
- `ReservationRepository`: `createReservation()`, `getReservation()`, `commitReservation()`, `releaseReservation()`, `expireStaleReservations()`
- `BudgetRepository`: `getBudget()`, `reserveBudget()`, `commitBudget()`, `releaseBudget()`

- [ ] **Step 1: Implement `promotion.repository.ts` for campaigns, rules, and targets**
- [ ] **Step 2: Implement `coupon.repository.ts` with atomic redemption increment/decrement checks**
- [ ] **Step 3: Implement `reservation.repository.ts` with state transition guards (`RESERVED` -> `COMMITTED` / `RELEASED`)**
- [ ] **Step 4: Implement `budget.repository.ts` with atomic PostgreSQL balance checks**
- [ ] **Step 5: Verify types with `pnpm --filter promotion-service check-types`**
- [ ] **Step 6: Commit Task 3**

---

### Task 4: Discount Quote Engine, Stacking Rules & Business Service

**Files:**

- Create: `apps/promotion-service/src/services/promotion-evaluator.ts`
- Create: `apps/promotion-service/src/services/promotion.service.ts`

**Interfaces:**

- `PromotionEvaluator`: Evaluates eligibility conditions (minimum order value, customer segments, product/category/seller targets, date schedule, exclusions).
- `PromotionService`:
  - `getActivePromotions()`
  - `validateCoupon(code, context)`
  - `calculateQuote(cartItems, customerId, couponCodes)`
  - `createReservation(input)`
  - `commitReservation(reservationId, orderId)`
  - `releaseReservation(reservationId)`
  - `adminCreatePromotion(input)`
  - `adminUpdatePromotion(id, input)`
  - `adminActivatePromotion(id)`
  - `adminDeactivatePromotion(id)`
  - `adminCreateCoupon(input)`
  - `adminGetRedemptions(promotionId)`
  - `adminGetOverview()`

- [ ] **Step 1: Implement `promotion-evaluator.ts` for discount calculation and stacking priority**
- [ ] **Step 2: Implement `promotion.service.ts` orchestrating validation, reservations, commits, and audits**
- [ ] **Step 3: Add Redis caching for active campaigns and hot coupon lookups**
- [ ] **Step 4: Verify type safety and commit Task 4**

---

### Task 5: Kafka Event Integration (Producers & Order Consumers)

**Files:**

- Create: `apps/promotion-service/src/events/producers/promotion.producer.ts`
- Create: `apps/promotion-service/src/events/consumers/order-events.consumer.ts`
- Create: `apps/promotion-service/src/utils/kafka.ts`

**Interfaces:**

- Producers: `publishPromotionCreated`, `publishPromotionActivated`, `publishPromotionDeactivated`, `publishPromotionReserved`, `publishPromotionRedeemed`, `publishPromotionReservationReleased`, `publishPromotionBudgetExhausted`.
- Consumers: Reads `order.completed` / `order.confirmed` to commit reservations; reads `order.cancelled` to release redemptions.

- [ ] **Step 1: Set up Kafka client connection wrapper with graceful error handling**
- [ ] **Step 2: Implement promotion event producers following the `{ value: payload }` envelope**
- [ ] **Step 3: Implement consumer handlers for order confirmation and cancellation reconciliation**
- [ ] **Step 4: Commit Task 5**

---

### Task 6: Hono 4 HTTP Application, Routes, Observability & RBAC

**Files:**

- Create: `apps/promotion-service/src/middleware/auth.middleware.ts`
- Create: `apps/promotion-service/src/controllers/promotion.controller.ts`
- Create: `apps/promotion-service/src/routes/promotion.routes.ts`
- Create: `apps/promotion-service/src/observability/metrics.ts`
- Create: `apps/promotion-service/src/server.ts`
- Create: `apps/promotion-service/src/index.ts`

**Interfaces:**

- Customer Endpoints:
  - `GET /api/v1/promotions/active`
  - `GET /api/v1/promotions/:promotionId`
  - `POST /api/v1/promotions/validate`
  - `POST /api/v1/promotions/quote`
  - `POST /api/v1/promotions/reservations`
  - `POST /api/v1/promotions/reservations/:id/commit`
  - `POST /api/v1/promotions/reservations/:id/release`
- Admin Endpoints:
  - `POST /api/v1/admin/promotions`
  - `PATCH /api/v1/admin/promotions/:promotionId`
  - `POST /api/v1/admin/promotions/:promotionId/activate`
  - `POST /api/v1/admin/promotions/:promotionId/deactivate`
  - `POST /api/v1/admin/coupons`
  - `GET /api/v1/admin/promotions/:promotionId/redemptions`
  - `GET /api/v1/admin/promotions/overview`
- Probes: `/health`, `/ready`, `/metrics`.

- [ ] **Step 1: Set up auth middleware (`shouldBeUser`, `shouldBeAdmin`, `optionalUserOrGuest`)**
- [ ] **Step 2: Implement controllers and mount Hono routes**
- [ ] **Step 3: Wire Prometheus metrics and structured Pino logging**
- [ ] **Step 4: Wire server startup and graceful shutdown**
- [ ] **Step 5: Verify types with `pnpm --filter promotion-service check-types`**
- [ ] **Step 6: Commit Task 6**

---

### Task 7: Comprehensive Automated Test Suite

**Files:**

- Create: `apps/promotion-service/tests/promotion-service.test.ts`
- Modify: `apps/promotion-service/package.json`

**Interfaces:**

- Test runner: `tsx --env-file-if-exists=.env tests/promotion-service.test.ts`
- Test suites:
  1. Health Probes (`/health`, `/ready`) & Prometheus exposition (`/metrics`)
  2. Role-Based Access Control (Admin route rejection for unauthenticated/user callers)
  3. Campaign creation, scheduling, and activation lifecycle
  4. Coupon code generation and case-insensitive validation
  5. Discount quote calculation (percentage discount, fixed amount discount, free shipping)
  6. Targeting evaluation (product, category, seller filters & exclusions)
  7. Minimum order value & maximum discount capping
  8. Atomic checkout reservation with budget allocation
  9. Reservation commit on order confirmation and redemptions logging
  10. Reservation release and budget rollback on checkout abandonment
  11. Concurrency limit & budget exhaustion protection

- [ ] **Step 1: Write tests covering all 11 test scenarios**
- [ ] **Step 2: Execute `pnpm --filter promotion-service test` against local database**
- [ ] **Step 3: Verify all test cases pass cleanly**
- [ ] **Step 4: Commit Task 7**

---

### Task 8: API Gateway Routing, Docker, Kubernetes & Monorepo Docs

**Files:**

- Modify: `apps/api-gateway/src/routing/admin.routes.ts`
- Modify: `apps/api-gateway/src/index.ts`
- Create: `apps/promotion-service/Dockerfile`
- Create: `apps/promotion-service/README.md`
- Create: `apps/promotion-service/AGENTS.md`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `infrastructure/kubernetes/base/services/promotion-service.yaml`
- Modify: `infrastructure/kubernetes/base/ingress.yaml`
- Modify: `infrastructure/kubernetes/base/kustomization.yaml`
- Modify: `.github/workflows/reusable-docker-build.yml`
- Modify: `.github/workflows/migrate.yml`
- Modify: `.github/workflows/staging.yml`
- Modify: `.github/workflows/production.yml`
- Modify: `AGENTS.md` (root)
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/API.md`
- Modify: `docs/DEPENDENCIES.md`
- Modify: `.agents/skills/root-architecture/SKILL.md`
- Modify: `.agents/skills/docker-devops/SKILL.md`

- [ ] **Step 1: Register `/api/v1/promotions` and `/api/v1/admin/promotions` routes in API Gateway**
- [ ] **Step 2: Add Dockerfile and register service in `docker-compose.yml` and `.env.example`**
- [ ] **Step 3: Add Kubernetes manifests (`promotion-service.yaml`, ingress, kustomization)**
- [ ] **Step 4: Update GitHub Actions CI/CD workflows (Docker build matrix, migrations, rollouts)**
- [ ] **Step 5: Update monorepo documentation and sync AI skills (`pnpm run skills:sync`)**
- [ ] **Step 6: Run full verification (`pnpm check-types`, `pnpm --filter promotion-service test`)**
- [ ] **Step 7: Commit and push Task 8**
