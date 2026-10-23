# vendor-service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade, enterprise-ready `vendor-service` (Node.js, TypeScript, NestJS 10 with `@nestjs/platform-fastify`, PostgreSQL via `@repo/vendor-db` Prisma client, Redis, Kafka, Zod, OpenTelemetry, Docker) providing merchant onboarding, legal entity management, multi-step KYB verification workflows, representative authorization, and lifecycle state management.

**Architecture:** A NestJS microservice running Fastify adapter on port 8020 connected to PostgreSQL (`vendor_db`) via a dedicated `@repo/vendor-db` Prisma package. It handles merchant onboarding in draft mode, document uploads (linking media-service media IDs), submission for KYB verification, and administrative review actions (approve, reject, suspend, reactivate). Domain events are broadcast via Kafka, and API Gateway routes incoming requests to `/api/v1/vendors` and `/api/v1/admin/vendors`.

**Tech Stack:** Node.js 20+ (ESM), TypeScript, NestJS 10, `@nestjs/platform-fastify`, `@repo/vendor-db` (Prisma Client), `@repo/types`, `@repo/kafka`, `@repo/monitoring`, `@repo/redis`, `zod`, `pino`, `uuid`.

**Spec:** [docs/superpowers/specs/2026-10-22-vendor-service-design.md](file:///Users/taha/projects/microservices-ecommerce/docs/superpowers/specs/2026-10-22-vendor-service-design.md)

## Global Constraints

- Port: 8020
- Runtime & Framework: Node.js 20+ ESM, NestJS 10 with Fastify platform adapter (`@nestjs/platform-fastify`).
- Database: Dedicated database `vendor_db` in PostgreSQL via `@repo/vendor-db` Prisma client.
- Auth: Clerk session headers passed by API Gateway (`x-user-id`, `x-user-email`, `x-user-role`). Admin routes require `role === "admin"` or timing-safe gateway internal secret.
- Event Envelope: Kafkajs with `{ value: payload }` envelope; consumers read `message.value` and handle async errors safely.
- Monorepo Boundaries: Never import app-to-app; domain schemas and contracts live in `@repo/types`.

---

### Task 1: Shared Domain Contracts in `@repo/types`

**Files:**

- Create: `packages/types/src/vendor.ts`
- Modify: `packages/types/src/index.ts`
- Test: `packages/types/tests/vendor.test.ts`

**Interfaces:**

- Produces: `VendorStatus`, `OrganizationType`, `DocumentType`, `DocumentVerificationStatus`, `MemberRole`, `CreateVendorInput`, `UpdateVendorInput`, `AttachDocumentInput`, `SubmitVerificationInput`, `AdminVendorDecisionInput`, `VendorEventPayloads`.

- [x] **Step 1: Write unit tests for vendor types & Zod schemas**
      Create `packages/types/tests/vendor.test.ts` verifying that `CreateVendorSchema`, `AttachDocumentSchema`, and event schemas parse valid payloads and reject invalid data.
- [x] **Step 2: Run test to verify it fails**
      Run: `pnpm --filter @repo/types test`
      Expected: FAIL with missing module/schemas.
- [x] **Step 3: Implement Zod schemas and TypeScript interfaces**
      Create `packages/types/src/vendor.ts` defining all enums, Zod schemas, inferred types, and Kafka event types.
- [x] **Step 4: Export from index and verify tests pass**
      Modify `packages/types/src/index.ts` to export all symbols from `./vendor.js`.
      Run: `pnpm --filter @repo/types test`
      Expected: PASS.
- [x] **Step 5: Monorepo type-check on `@repo/types`**
      Run: `pnpm --filter @repo/types check-types`
      Expected: PASS (0 errors).

---

### Task 2: Shared Database Package `@repo/vendor-db`

**Files:**

- Create: `packages/vendor-db/package.json`
- Create: `packages/vendor-db/tsconfig.json`
- Create: `packages/vendor-db/prisma/schema.prisma`
- Create: `packages/vendor-db/src/index.ts`
- Modify: Root `package.json` & `.env.example`

**Interfaces:**

- Consumes: PostgreSQL connection string (`DATABASE_URL`).
- Produces: `PrismaClient`, `Vendor`, `VendorBusinessProfile`, `VendorDocument`, `VendorVerification`, `VendorMember`, `VendorStatusHistory` models and client exports.

- [x] **Step 1: Create package.json and tsconfig.json for `@repo/vendor-db`**
      Set up ESM configuration and scripts matching `@repo/user-db` (`db:generate`, `db:migrate`, `build`).
- [x] **Step 2: Define Prisma Schema for `vendor_db`**
      Implement the schema specified in design doc in `packages/vendor-db/prisma/schema.prisma`.
- [x] **Step 3: Create package entrypoint `packages/vendor-db/src/index.ts`**
      Export `PrismaClient` and all generated Prisma models and enums.
- [x] **Step 4: Run `pnpm install` and generate Prisma client**
      Run: `pnpm install && pnpm --filter @repo/vendor-db db:generate`
      Expected: Client generated in `packages/vendor-db/generated/prisma`.
- [x] **Step 5: Verify build & typecheck**
      Run: `pnpm --filter @repo/vendor-db check-types`
      Expected: PASS (0 errors).

---

### Task 3: Kafka Topics Registration in `@repo/kafka`

**Files:**

- Modify: `packages/kafka/src/init-topics.ts`

**Interfaces:**

- Produces: Topic definitions for `vendor.registered`, `vendor.verification.requested`, `vendor.verified`, `vendor.rejected`, `vendor.suspended`, `vendor.reactivated`.

- [x] **Step 1: Add vendor topics to `ALL_LAREKMART_TOPICS` in `packages/kafka/src/init-topics.ts`**
      Register:
  - `vendor.registered`
  - `vendor.verification.requested`
  - `vendor.verified`
  - `vendor.rejected`
  - `vendor.suspended`
  - `vendor.reactivated`
- [x] **Step 2: Verify package typecheck**
      Run: `pnpm --filter @repo/kafka check-types`
      Expected: PASS (0 errors).

---

### Task 4: Scaffold `apps/vendor-service` with NestJS & Fastify

**Files:**

- Create: `apps/vendor-service/package.json`
- Create: `apps/vendor-service/tsconfig.json`
- Create: `apps/vendor-service/.env.example`
- Create: `apps/vendor-service/.env`
- Create: `apps/vendor-service/Dockerfile`
- Create: `apps/vendor-service/src/config/env.ts`
- Create: `apps/vendor-service/src/database/database.module.ts`
- Create: `apps/vendor-service/src/database/prisma.service.ts`

**Interfaces:**

- Consumes: `@repo/vendor-db`, `@repo/types`, `@repo/redis`, `@repo/kafka`.
- Produces: NestJS app context, Fastify adapter runner on port 8020, database lifecycle service.

- [x] **Step 1: Create package.json and tsconfig.json**
      Configure `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify`, `fastify`, `@repo/vendor-db`, `@repo/types`, `@repo/redis`, `@repo/kafka`, `zod`.
- [x] **Step 2: Create environment configuration `src/config/env.ts`**
      Validate `NODE_ENV`, `PORT` (default 8020), `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `GATEWAY_INTERNAL_SECRET`.
- [x] **Step 3: Implement PrismaService and DatabaseModule**
      Lifecycle hooks (`onModuleInit`, `onModuleDestroy`) connecting to Prisma Client.
- [x] **Step 4: Run `pnpm install` and verify monorepo linking**
      Run: `pnpm install`
      Expected: Links dependencies cleanly without errors.

---

### Task 5: Core Domain Modules & Services

**Files:**

- Create: `apps/vendor-service/src/common/guards/auth.guard.ts`
- Create: `apps/vendor-service/src/common/guards/admin.guard.ts`
- Create: `apps/vendor-service/src/common/guards/vendor-member.guard.ts`
- Create: `apps/vendor-service/src/common/filters/http-exception.filter.ts`
- Create: `apps/vendor-service/src/modules/vendors/vendors.service.ts`
- Create: `apps/vendor-service/src/modules/vendors/vendors.controller.ts`
- Create: `apps/vendor-service/src/modules/documents/documents.service.ts`
- Create: `apps/vendor-service/src/modules/documents/documents.controller.ts`
- Create: `apps/vendor-service/src/modules/admin/admin-vendors.service.ts`
- Create: `apps/vendor-service/src/modules/admin/admin-vendors.controller.ts`
- Create: `apps/vendor-service/src/health/health.controller.ts`
- Create: `apps/vendor-service/src/kafka/kafka.service.ts`
- Create: `apps/vendor-service/src/app.module.ts`
- Create: `apps/vendor-service/src/main.ts`

**Interfaces:**

- Produces:
  - `VendorsService`: `createVendor`, `getVendorById`, `updateVendor`, `submitForVerification`, `getVendorsForUser`.
  - `DocumentsService`: `attachDocument`, `getVendorDocuments`, `verifyDocument`.
  - `AdminVendorsService`: `listVendors`, `approveVendor`, `rejectVendor`, `suspendVendor`, `reactivateVendor`.
  - `KafkaService`: `emitVendorEvent(topic, payload)`.

- [x] **Step 1: Implement Auth Guards & Exception Filters**
      Fastify request parsing of `x-user-id`, `x-user-role`, `x-internal-secret` with RFC-compliant error responses.
- [x] **Step 2: Implement Kafka Producer Service**
      Kafka producer integration with typed topic publishing and safety fallback.
- [x] **Step 3: Implement Vendors Module**
      Merchant registration, draft onboarding, profile updates, and verification submission checks.
- [x] **Step 4: Implement Documents Module**
      Attaching media IDs, document verification tracking, and requirement validation.
- [x] **Step 5: Implement Admin Backoffice Module**
      Backoffice queue listing, audit logging, and status transitions (approve, reject, suspend, reactivate).
- [x] **Step 6: Implement Health & Metrics Endpoints**
      `/health`, `/ready`, `/metrics`, and `/api/v1/vendors/health`.
- [x] **Step 7: Wire into AppModule & Bootstrap Main.ts**
      Configure Fastify adapter, CORS, graceful shutdown, and port 8020 listening.

---

### Task 6: Integration Tests for `vendor-service`

**Files:**

- Create: `apps/vendor-service/tests/vendor-service.test.ts`
- Modify: `apps/vendor-service/package.json`

**Interfaces:**

- Test coverage for:
  - Vendor registration (`POST /api/v1/vendors`).
  - Document attachment (`POST /api/v1/vendors/:id/documents`).
  - Verification submission validation (`POST /api/v1/vendors/:id/submit-verification`).
  - Admin approval, rejection, and suspension endpoints.
  - Member access authorization.

- [x] **Step 1: Write end-to-end integration test suite using Fastify inject**
- [x] **Step 2: Run test suite**
      Run: `pnpm --filter vendor-service test`
      Expected: All tests PASS.
- [x] **Step 3: Type-check `vendor-service`**
      Run: `pnpm --filter vendor-service check-types`
      Expected: PASS (0 errors).

---

### Task 7: API Gateway Reverse Proxy Routing

**Files:**

- Modify: `apps/api-gateway/src/config/env.ts`
- Modify: `apps/api-gateway/src/gateway/service-registry.ts`
- Modify: `apps/api-gateway/src/routing/public.routes.ts`
- Modify: `apps/api-gateway/src/routing/admin.routes.ts`
- Modify: `apps/api-gateway/.env`
- Modify: `apps/api-gateway/.env.example`

**Interfaces:**

- Routes `/api/v1/vendors/*` and `/api/v1/admin/vendors/*` to `http://localhost:8020`.

- [x] **Step 1: Update API Gateway environment configuration**
      Add `VENDOR_SERVICE_URL: z.string().default("http://localhost:8020")`.
- [x] **Step 2: Add `vendor` to service registry**
- [x] **Step 3: Register public and admin proxy routes in gateway**
- [x] **Step 4: Verify API Gateway typecheck**
      Run: `pnpm --filter api-gateway check-types`
      Expected: PASS (0 errors).

---

### Task 8: Infrastructure, Compose & Kubernetes Network Policies

**Files:**

- Modify: `docker-compose.yml`
- Modify: `.env` and `.env.example`
- Modify: `infrastructure/kubernetes/base/network-policies/network-policies.yaml`
- Modify: Root `AGENTS.md` and `README.md`

- [x] **Step 1: Update root `.env` and `.env.example`**
      Add `VENDOR_SERVICE_PORT=8020` and append `vendor_db` to `POSTGRES_MULTIPLE_DATABASES`.
- [x] **Step 2: Add `vendor-service` to `docker-compose.yml`**
      Add service definition on port 8020 with postgres, redis, kafka dependencies.
- [x] **Step 3: Update Kubernetes Network Policy**
      Add `vendor-service` (port 8020) to `allow-ingress-to-api-services` in `network-policies.yaml`.
- [x] **Step 4: Update Root AGENTS.md & README.md**
      Document `vendor-service` as the 22nd backend service in architecture and repository tables.

---

### Task 9: Monorepo Verification & Quality Gate

- [x] **Step 1: Full Monorepo Type Check**
      Run: `pnpm --filter @repo/types check-types && pnpm --filter @repo/vendor-db check-types && pnpm --filter vendor-service check-types && pnpm --filter api-gateway check-types`
      Expected: PASS across all affected workspaces.
- [x] **Step 2: Monorepo Test Run**
      Run: `pnpm --filter @repo/types test && pnpm --filter vendor-service test`
      Expected: PASS across all workspaces with test suites.
- [ ] **Step 3: Format Code**
      Run: `pnpm format`
