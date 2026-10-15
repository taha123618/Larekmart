# tax-service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade, jurisdiction-aware `tax-service` (Node.js, TypeScript, Fastify 5, Drizzle ORM, MySQL, Redis, Zod, decimal arithmetic) providing auditable tax quotes, order calculation snapshots, refund adjustments, configurable versioned rules, exemptions, adapter pattern, and Kafka events.

**Architecture:** A standalone Fastify 5 microservice on port 8017 connecting to MySQL via Drizzle ORM and Redis for caching. Tax calculation uses `decimal.js` for zero floating-point errors, evaluating hierarchical jurisdictions (country, state/region, municipality) and versioned tax rules with inclusive/exclusive modes. Pluggable tax provider adapter architecture allows internal rule execution or delegation to external providers with audit logging. Gateway routes and Kafka events ensure seamless monorepo integration.

**Tech Stack:** Node.js (ESM), TypeScript, Fastify 5, Drizzle ORM (`drizzle-orm/mysql-core`), `mysql2`, `@repo/types`, `@repo/kafka`, `@repo/monitoring`, `@repo/redis`, `decimal.js`, `zod`, `uuid`.

**Spec:** User request and requirements for `tax-service` (port 8017).

## Global Constraints

- Port: 8017
- Decimal arithmetic: Zero JavaScript floating-point arithmetic for currency and tax amounts; all calculations must use `decimal.js` with explicit rounding.
- Runtime & Framework: Node.js 20+ ESM, Fastify 5, Drizzle ORM (`drizzle-orm/mysql-core`), MySQL.
- Security: Header sanitization and timing-safe internal secret comparison using SHA-256 HMAC / `safeTimingCompare`. Redact provider secrets and sensitive exemption data.
- Event envelope: Kafkajs with `{ value: payload }` envelope; handlers must read `message.value` and catch async errors safely.
- Monorepo boundaries: Never import an app into another app; shared contracts and schemas live in `@repo/types`.

---

### Task 1: Shared Domain Types & Contracts in `@repo/types`

**Files:**

- Create: `packages/types/src/tax.ts`
- Modify: `packages/types/src/index.ts`
- Test: `packages/types/tests/tax.test.ts`

- [ ] **Step 1: Write the failing test for tax schemas**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement Zod schemas and TypeScript types in `packages/types/src/tax.ts`**
- [ ] **Step 4: Export from `packages/types/src/index.ts` and verify test passes**

---

### Task 2: Scaffold `apps/tax-service` Workspace & Configuration

**Files:**

- Create: `apps/tax-service/package.json`
- Create: `apps/tax-service/tsconfig.json`
- Create: `apps/tax-service/.env.example`
- Create: `apps/tax-service/.env`
- Create: `apps/tax-service/Dockerfile`
- Create: `apps/tax-service/src/config/env.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**
- [ ] **Step 2: Create environment configuration with Zod validation**
- [ ] **Step 3: Run `pnpm install` and verify package resolves in monorepo**

---

### Task 3: Drizzle MySQL Database Schema & Repository Layer

**Files:**

- Create: `apps/tax-service/src/db/schema.ts`
- Create: `apps/tax-service/src/db/connection.ts`
- Create: `apps/tax-service/src/db/seed.ts`
- Create: `apps/tax-service/src/repositories/jurisdiction.repository.ts`
- Create: `apps/tax-service/src/repositories/tax-rule.repository.ts`
- Create: `apps/tax-service/src/repositories/tax-category.repository.ts`
- Create: `apps/tax-service/src/repositories/tax-calculation.repository.ts`

- [ ] **Step 1: Define Drizzle schema for 7 required tables**
- [ ] **Step 2: Setup MySQL connection pool and Drizzle client**
- [ ] **Step 3: Create repository implementations with CRUD and query capabilities**

---

### Task 4: Decimal Calculation Engine & Provider Adapter Pattern

**Files:**

- Create: `apps/tax-service/src/services/calculator.ts`
- Create: `apps/tax-service/src/adapters/tax-provider.interface.ts`
- Create: `apps/tax-service/src/adapters/standard-tax-engine.adapter.ts`
- Create: `apps/tax-service/src/adapters/external-tax-provider.adapter.ts`
- Create: `apps/tax-service/src/adapters/provider-factory.ts`

- [ ] **Step 1: Implement `decimal.js` calculation engine (exclusive & inclusive tax, rounding, exemptions, line items)**
- [ ] **Step 2: Implement refund/returns proportional tax adjustment calculation**
- [ ] **Step 3: Implement provider adapter interface and standard rule engine adapter**
- [ ] **Step 4: Implement external provider adapter stub with credential redaction & latency logging**

---

### Task 5: Fastify App, Authentication Middleware & REST Routes

**Files:**

- Create: `apps/tax-service/src/middleware/auth.middleware.ts`
- Create: `apps/tax-service/src/controllers/tax.controller.ts`
- Create: `apps/tax-service/src/controllers/admin-tax.controller.ts`
- Create: `apps/tax-service/src/routes/tax.routes.ts`
- Create: `apps/tax-service/src/routes/admin-tax.routes.ts`
- Create: `apps/tax-service/src/routes/health.routes.ts`
- Create: `apps/tax-service/src/app.ts`
- Create: `apps/tax-service/src/server.ts`
- Create: `apps/tax-service/src/index.ts`

- [ ] **Step 1: Implement timing-safe internal secret authentication and Clerk admin auth middleware**
- [ ] **Step 2: Implement controllers and route handlers for quotes, calculations, snapshot lookup, returns, jurisdictions, categories, and admin rule management**
- [ ] **Step 3: Wire Fastify application with CORS, logging, health probes, and error handling**

---

### Task 6: Kafka Event Integration (Consumers & Producers)

**Files:**

- Create: `apps/tax-service/src/events/producers/tax.producer.ts`
- Create: `apps/tax-service/src/events/consumers/order.consumer.ts`
- Create: `apps/tax-service/src/events/consumers/product.consumer.ts`
- Create: `apps/tax-service/src/events/index.ts`

- [ ] **Step 1: Implement tax Kafka event producer with typed schemas**
- [ ] **Step 2: Implement consumers for `order.created`, `product.tax-category.updated`, and `tax.rules.updated` with safe error trapping**
- [ ] **Step 3: Connect event consumers on service start**

---

### Task 7: API Gateway Integration, Docker Compose & Monorepo Docs

**Files:**

- Modify: `apps/api-gateway/src/config/env.ts`
- Modify: `apps/api-gateway/src/gateway/service-registry.ts`
- Modify: `apps/api-gateway/src/routing/public.routes.ts`
- Modify: `apps/api-gateway/src/routing/admin.routes.ts`
- Modify: `docker-compose.yml`
- Modify: `AGENTS.md`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Add tax service target and routes to API Gateway**
- [ ] **Step 2: Add MySQL container and tax-service container to `docker-compose.yml`**
- [ ] **Step 3: Update root `AGENTS.md` and `docs/ARCHITECTURE.md`**

---

### Task 8: Comprehensive Test Suite & Monorepo Verification

**Files:**

- Create: `apps/tax-service/tests/tax-service.test.ts`

- [ ] **Step 1: Write end-to-end and unit tests verifying quotes, calculations, inclusive/exclusive, exemptions, refund adjustments, admin rules, and security**
- [ ] **Step 2: Run `pnpm --filter tax-service test`**
- [ ] **Step 3: Run monorepo `pnpm check-types` and `pnpm test`**
- [ ] **Step 4: Format and commit changes**
