# return-service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade, multi-seller marketplace `return-service` (Node.js, TypeScript, Koa 2, Drizzle ORM, MySQL 8.0, Redis, Kafka, Zod, decimal arithmetic) managing the complete product-return and refund coordination lifecycle without violating domain boundaries.

**Architecture:** A standalone Koa 2 microservice on port 8018 connecting to MySQL (`return_db`) via Drizzle ORM and Redis for caching and rate limiting. It enforces an explicit state machine with audit trails, coordinates return labels via `shipping-service`, records granular inspection outcomes (`RESTOCK_SELLABLE`, `OPEN_BOX`, `DAMAGED_SCRAP`, `RETURN_TO_VENDOR`), and drives refunds through a transactional outbox SAGA with `payment-service` and restocking with `inventory-service`.

**Tech Stack:** Node.js (ESM), TypeScript, Koa 2 (`@koa/router`, `koa-bodyparser`, `@koa/cors`), Drizzle ORM (`drizzle-orm/mysql-core`), `mysql2`, `@repo/types`, `@repo/kafka`, `@repo/monitoring`, `@repo/redis`, `decimal.js`, `zod`, `uuid`.

**Spec:** User request and `/grill-me` aligned requirements for `return-service` (port 8018).

## Global Constraints

- **Port**: 8018
- **Database**: MySQL 8.0 (`return_db`), managed via Drizzle ORM
- **Runtime & Framework**: Node.js 20+ ESM, Koa 2 (`@koa/router`, `koa-bodyparser`, `@koa/cors`)
- **Arithmetic**: Zero JavaScript floating-point errors for currency, tax adjustments, and refunds using `decimal.js`
- **Security**: Timing-safe internal secret comparison (`safeTimingCompare`), Clerk user/admin JWT claim verification
- **Event Envelope**: kafkajs with `{ value: payload }` envelope; consumers read `message.value` and catch async errors safely
- **Monorepo Boundaries**: Zero service-to-service HTTP calls; all cross-service coordination happens asynchronously via Kafka; shared contracts live in `@repo/types`

---

### Task 1: Shared Domain Types & Contracts in `@repo/types`

**Files:**
- Create: `packages/types/src/returns.ts`
- Modify: `packages/types/src/index.ts`
- Test: `packages/types/tests/returns.test.ts`

**Interfaces:**
- Produces: `ReturnStatus`, `ReturnReason`, `ReturnItemCondition`, `ReturnInspectionDisposition`, `ReturnRefundStatus`, `ReturnItemSchema`, `CreateReturnRequestSchema`, `AdminApproveReturnSchema`, `AdminRejectReturnSchema`, `RecordInspectionSchema`, `ReturnEvidenceSchema`, `ReturnStateTransitionSchema`, Kafka payload interfaces (`ReturnRequestedPayload`, `ReturnApprovedPayload`, `ReturnRejectedPayload`, `ReturnShipmentRequestedPayload`, `ReturnReceivedPayload`, `ReturnInspectionCompletedPayload`, `ReturnRefundRequestedPayload`, `ReturnCompletedPayload`, `ReturnCancelledPayload`).

- [ ] **Step 1: Write the test for return domain contracts**

Write `packages/types/tests/returns.test.ts` testing schema validation for return creation, item condition enum checks, disposition types, and Kafka payload contracts.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx packages/types/tests/returns.test.ts`
Expected: FAIL with module not found or export missing.

- [ ] **Step 3: Implement Zod schemas and TypeScript interfaces in `packages/types/src/returns.ts`**

Define enums, schemas, and typed payload interfaces.

- [ ] **Step 4: Export from `packages/types/src/index.ts` and run test**

Run: `npx tsx packages/types/tests/returns.test.ts`
Expected: PASS with 100% assertions verified.

- [ ] **Step 5: Verify types**

Run: `pnpm --filter @repo/types check-types`
Expected: PASS.

---

### Task 2: Scaffold `apps/return-service` Workspace & Configuration

**Files:**
- Create: `apps/return-service/package.json`
- Create: `apps/return-service/tsconfig.json`
- Create: `apps/return-service/.env.example`
- Create: `apps/return-service/.env`
- Create: `apps/return-service/Dockerfile`
- Create: `apps/return-service/drizzle.config.ts`
- Create: `apps/return-service/src/config/env.ts`

**Interfaces:**
- Produces: Typed, validated `config` object with port 8018, MySQL URL, Redis URL, Kafka brokers, and Clerk secret keys.

- [ ] **Step 1: Create package.json and tsconfig.json**

Configure `"type": "module"`, dependencies (`koa`, `@koa/router`, `koa-bodyparser`, `@koa/cors`, `drizzle-orm`, `mysql2`, `decimal.js`, `zod`, `uuid`, `@repo/types`, `@repo/kafka`, `@repo/monitoring`, `@repo/redis`), and scripts (`dev`, `build`, `check-types`, `test`, `db:generate`, `db:migrate`, `db:seed`).

- [ ] **Step 2: Create environment templates & Zod config loader in `src/config/env.ts`**

Validate `PORT`, `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `GATEWAY_INTERNAL_SECRET`, and `CLERK_SECRET_KEY`.

- [ ] **Step 3: Run package installation and type check**

Run: `pnpm install` and `pnpm --filter return-service check-types`
Expected: PASS.

---

### Task 3: Drizzle MySQL Database Schema, Connection & Migrations

**Files:**
- Create: `apps/return-service/src/db/schema.ts`
- Create: `apps/return-service/src/db/connection.ts`
- Create: `apps/return-service/src/db/migrate.ts`
- Create: `apps/return-service/src/db/seed.ts`

**Interfaces:**
- Produces: MySQL tables (`returns`, `return_items`, `return_reasons`, `return_media`, `return_shipments`, `return_inspections`, `return_refunds`, `return_state_transitions`, `return_policy_versions`, `return_outbox`), connection pool export `db`, migration runner, and initial policy/reasons seed script.

- [ ] **Step 1: Write Drizzle MySQL schema in `src/db/schema.ts`**

Define tables with primary keys, indexes, foreign keys, timestamps, and decimal columns for financial fields.

- [ ] **Step 2: Setup connection pool and migration scripts**

Implement `connection.ts` using `mysql2/promise` and `drizzle-orm/mysql2`. Implement `migrate.ts` creating tables idempotently if they do not exist.

- [ ] **Step 3: Implement seed script in `src/db/seed.ts`**

Seed default return reasons (`DAMAGED_TRANSIT`, `DEFECTIVE`, `WRONG_ITEM`, `NOT_AS_DESCRIBED`, `CHANGED_MIND`, `SIZE_MISMATCH`) and standard 14-day policy version.

- [ ] **Step 4: Verify schema generation and compilation**

Run: `pnpm --filter return-service check-types`
Expected: PASS.

---

### Task 4: Repositories & Data Access Layer

**Files:**
- Create: `apps/return-service/src/repositories/return.repository.ts`
- Create: `apps/return-service/src/repositories/policy.repository.ts`
- Create: `apps/return-service/src/repositories/shipment.repository.ts`
- Create: `apps/return-service/src/repositories/inspection.repository.ts`
- Create: `apps/return-service/src/repositories/refund.repository.ts`
- Create: `apps/return-service/src/repositories/outbox.repository.ts`

**Interfaces:**
- Produces: Strongly typed data access methods for returns, items, policy checks, shipments, inspections, refunds, and transactional outbox.

- [ ] **Step 1: Implement `ReturnRepository`**

CRUD for returns, item insertions, queries by customer, order, and status, and state transition logging.

- [ ] **Step 2: Implement `PolicyRepository`, `ShipmentRepository`, `InspectionRepository`, and `RefundRepository`**

Handles policy checks, shipment tracking updates, inspection disposition logging, and idempotent refund records.

- [ ] **Step 3: Implement `OutboxRepository`**

Inserts outbox events in the same database transaction as return state changes; reads unpublished events for Kafka dispatch.

- [ ] **Step 4: Verify type safety**

Run: `pnpm --filter return-service check-types`
Expected: PASS.

---

### Task 5: Core Domain Services & Business Logic

**Files:**
- Create: `apps/return-service/src/services/state-machine.ts`
- Create: `apps/return-service/src/services/eligibility.service.ts`
- Create: `apps/return-service/src/services/proration.service.ts`
- Create: `apps/return-service/src/services/return.service.ts`
- Create: `apps/return-service/src/services/admin-return.service.ts`

**Interfaces:**
- Produces: Explicit state transition guard (`canTransition`, `transitionTo`), eligibility validation against order delivery date and item rules, decimal-safe refund calculation engine, customer workflow service, and admin/seller operational service.

- [ ] **Step 1: Implement `state-machine.ts`**

Map allowed transitions (`REQUESTED` -> `APPROVED` | `REJECTED` | `CANCELLED`, `APPROVED` -> `AWAITING_RETURN_SHIPMENT`, `IN_TRANSIT` -> `RECEIVED` -> `INSPECTION` -> `REFUND_PENDING` -> `COMPLETED`, etc.) and reject illegal transitions.

- [ ] **Step 2: Implement `eligibility.service.ts`**

Validate order delivery window (14/30 days), delivered status, item eligibility, and mandatory evidence validation for damage claims.

- [ ] **Step 3: Implement `proration.service.ts`**

Decimal arithmetic using `decimal.js` to prorate item discounts, compute net paid refund amounts, and calculate return tax adjustments.

- [ ] **Step 4: Implement `ReturnService` and `AdminReturnService`**

Orchestrate customer creation, cancellation, evidence upload, tracking registration, admin/seller approvals, rejections, inspection dispositions, and refund retries.

- [ ] **Step 5: Verify type safety**

Run: `pnpm --filter return-service check-types`
Expected: PASS.

---

### Task 6: Koa Application, Middleware, Controllers & REST Routes

**Files:**
- Create: `apps/return-service/src/middleware/auth.middleware.ts`
- Create: `apps/return-service/src/middleware/error.middleware.ts`
- Create: `apps/return-service/src/controllers/customer-return.controller.ts`
- Create: `apps/return-service/src/controllers/admin-return.controller.ts`
- Create: `apps/return-service/src/routes/customer.routes.ts`
- Create: `apps/return-service/src/routes/admin.routes.ts`
- Create: `apps/return-service/src/routes/health.routes.ts`
- Create: `apps/return-service/src/app.ts`
- Create: `apps/return-service/src/server.ts`
- Create: `apps/return-service/src/index.ts`

**Interfaces:**
- Produces: Koa 2 HTTP server with CORS, body parser, error handler, Clerk customer auth (`shouldBeUser`), admin auth (`shouldBeAdmin`), timing-safe internal secret comparison (`safeTimingCompare`), and registered endpoints.

- [ ] **Step 1: Implement authentication & error middleware**

Verify Clerk session headers (`x-user-id`, `x-user-role`) and internal gateway secret (`x-internal-secret`) using constant-time comparison. Catch errors and return structured `{ message }` JSON.

- [ ] **Step 2: Implement customer and admin controllers and routes**

Route customer operations (`POST /api/v1/orders/:orderId/returns`, `GET /api/v1/me/returns`, `GET /api/v1/returns/:returnId`, `POST /api/v1/returns/:returnId/cancel`, `POST /api/v1/returns/:returnId/evidence`, `POST /api/v1/returns/:returnId/tracking`) and admin operations (`GET /api/v1/admin/returns`, `POST /api/v1/admin/returns/:returnId/approve`, `POST /api/v1/admin/returns/:returnId/reject`, `POST /api/v1/admin/returns/:returnId/inspection`, `POST /api/v1/admin/returns/:returnId/complete`, `POST /api/v1/admin/returns/:returnId/retry-refund`).

- [ ] **Step 3: Implement health and metrics routes (`/health`, `/ready`, `/metrics`)**

Liveness, MySQL and Redis connectivity readiness checks, and Prometheus metrics endpoint.

- [ ] **Step 4: Assemble `app.ts`, `server.ts`, and `index.ts`**

Export Koa app for testing; configure graceful shutdown on `SIGINT` and `SIGTERM`.

- [ ] **Step 5: Verify type safety**

Run: `pnpm --filter return-service check-types`
Expected: PASS.

---

### Task 7: Kafka Producers, Consumers & Transactional Outbox Worker

**Files:**
- Create: `apps/return-service/src/events/producers/return.producer.ts`
- Create: `apps/return-service/src/events/consumers/order.consumer.ts`
- Create: `apps/return-service/src/events/consumers/shipment.consumer.ts`
- Create: `apps/return-service/src/events/consumers/payment.consumer.ts`
- Create: `apps/return-service/src/events/consumers/inventory.consumer.ts`
- Create: `apps/return-service/src/events/outbox-worker.ts`

**Interfaces:**
- Produces: Kafka producers publishing `return.*` events with the `{ value: payload }` envelope; consumers handling `order.delivered`, `order.cancelled`, `shipment.return.received`, `shipment.return.updated`, `payment.refund.completed`, `payment.refund.failed`, `inventory.restock.completed`; outbox poller.

- [ ] **Step 1: Implement `ReturnEventProducer`**

Publishes strongly-typed events to `@repo/kafka` wrapped in the monorepo envelope `{ value: payload }`.

- [ ] **Step 2: Implement Kafka consumers with idempotent handlers**

Consume order, shipment, payment, and inventory events. Catch async errors safely to avoid crashing consumer loops.

- [ ] **Step 3: Implement `OutboxWorker`**

Polls `return_outbox` periodically, publishes messages via Kafka producer, and marks records as published or failed with exponential backoff.

- [ ] **Step 4: Verify type safety**

Run: `pnpm --filter return-service check-types`
Expected: PASS.

---

### Task 8: Comprehensive Test Suite (`tests/return-service.test.ts`)

**Files:**
- Create: `apps/return-service/tests/return-service.test.ts`

**Interfaces:**
- Produces: Standalone executable test suite using Node `assert` and Koa request injection.

- [ ] **Step 1: Write state machine tests**

Verify valid state progressions and assert that invalid transitions throw 400 Bad Request.

- [ ] **Step 2: Write eligibility and proration tests**

Verify return window cutoff rules and assert zero float errors in partial return refund prorations.

- [ ] **Step 3: Write auth and RBAC tests**

Assert customer routes reject unauthenticated requests; assert admin routes require admin role and reject forged gateway headers.

- [ ] **Step 4: Write HTTP endpoint integration tests**

Inject requests to `/health`, `/ready`, `/api/v1/orders/:orderId/returns`, and verify JSON payloads.

- [ ] **Step 5: Run tests and verify 100% pass**

Run: `pnpm --filter return-service test`
Expected: PASS with all test groups green.

---

### Task 9: Monorepo Integration & Infrastructure (`api-gateway`, Docker, K8s, Prometheus, CI/CD, Docs)

**Files:**
- Modify: `apps/api-gateway/src/gateway/service-registry.ts`
- Modify: `apps/api-gateway/src/routing/public.routes.ts`
- Modify: `apps/api-gateway/src/routing/admin.routes.ts`
- Modify: `docker-compose.yml`
- Modify: `docker/mysql/init-multiple-databases.sh` (or compose env `MYSQL_MULTIPLE_DATABASES`)
- Create: `infrastructure/kubernetes/base/services/return-service.yaml`
- Modify: `infrastructure/kubernetes/base/kustomization.yaml`
- Modify: `infrastructure/kubernetes/base/ingress.yaml`
- Modify: `infrastructure/kubernetes/base/network-policies/network-policies.yaml`
- Modify: `infrastructure/observability/prometheus/prometheus.yml`
- Modify: `.github/workflows/reusable-docker-build.yml`
- Modify: `.github/workflows/migrate.yml`
- Modify: `.github/workflows/staging.yml`
- Modify: `.github/workflows/production.yml`
- Create: `apps/return-service/README.md`
- Create: `apps/return-service/AGENTS.md`
- Create: `apps/return-service/.agents/skills/return-workflow/SKILL.md`
- Modify: `README.md`, `AGENTS.md`, `docs/DEPENDENCIES.md`, `docs/DOCKER.md`, `docs/TESTING.md`, `apps/client/AGENTS.md`, `apps/admin/AGENTS.md`

- [ ] **Step 1: Wire `return-service` into `apps/api-gateway`**

Register `returns` service on port 8018 and proxy `/api/v1/returns` and `/api/v1/admin/returns`.

- [ ] **Step 2: Update `docker-compose.yml`**

Add `return-service` container definition, port 8018, and ensure `MYSQL_MULTIPLE_DATABASES: "tax_db,return_db"` is configured on `mysql`.

- [ ] **Step 3: Update Kubernetes and Observability manifests**

Create `services/return-service.yaml`, update `kustomization.yaml`, `ingress.yaml` (routes for `/api/v1/returns` and `/api/v1/admin/returns`), `network-policies.yaml` (port 8018), and Prometheus scrape job.

- [ ] **Step 4: Update CI/CD GitHub Actions workflows**

Add `return-service` to build matrix, migration job, staging and production deployment steps.

- [ ] **Step 5: Create workspace documentation & sync AI skills**

Create `apps/return-service/README.md`, `apps/return-service/AGENTS.md`, and workspace skill `return-workflow/SKILL.md`. Update root docs (`README.md`, `AGENTS.md`, `docs/DOCKER.md`, `docs/DEPENDENCIES.md`, `docs/TESTING.md`). Run `pnpm run skills:sync`.

- [ ] **Step 6: Monorepo verification**

Run `pnpm check-types` across all workspaces to guarantee zero type errors. Run `pnpm --filter return-service test`.
