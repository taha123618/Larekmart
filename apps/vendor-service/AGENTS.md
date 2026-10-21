# AGENTS.md — apps/vendor-service

Scope: `apps/vendor-service` only. Root rules still apply — start there.

## What this service is

NestJS 10 microservice running with the Fastify platform adapter (`@nestjs/platform-fastify`) on port 8020.
It provides enterprise-grade marketplace vendor registration, legal organization identity management,
KYB (Know Your Business) verification workflows, business verification documents (referencing `media-service` media IDs),
authorized representative access, and lifecycle state management (DRAFT, PENDING_VERIFICATION, VERIFIED, REJECTED, SUSPENDED, TERMINATED, DEACTIVATED).

**Crucial Separation of Concerns:**
- `vendor-service`: Owns legal/business organization identity, registration credentials, business profiles, KYB documents, compliance verification, and representative access controls.
- `seller-service`: Owns marketplace storefronts, store name/logo/banner, selling operations, seller staff, and marketplace settings. A single verified vendor organization may own one or more seller accounts.

## Architecture & Layers

- `src/main.ts` — NestJS bootstrap running FastifyAdapter on port 8020 with CORS and graceful shutdown.
- `src/config/env.ts` — Zod validated configuration (`PORT=8020`, `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `GATEWAY_INTERNAL_SECRET`).
- `src/database/` — Global `DatabaseModule` with lifecycle-managed `PrismaService` backed by `@repo/vendor-db`.
- `src/kafka/` — `KafkaModule` and `KafkaService` publishing typed events using the `{ value: payload }` envelope.
- `src/redis/` — `RedisModule` and `RedisService` caching vendor data via `@repo/redis`.
- `src/common/` —
  - `guards/`: `AuthGuard` (`x-user-id`), `AdminGuard` (`role === "admin"` or `x-internal-secret`), `VendorMemberGuard` (membership or owner).
  - `filters/`: `HttpExceptionFilter` ensuring RFC-compliant and consistent `{ message, errors }` responses.
- `src/modules/` —
  - `vendors/`: `VendorsService`, `VendorsController`, `VendorsModule` handling vendor onboarding, drafts, and verification submissions.
  - `documents/`: `DocumentsService`, `DocumentsController`, `DocumentsModule` managing verification documents.
  - `admin/`: `AdminVendorsService`, `AdminVendorsController`, `AdminVendorsModule` managing approvals, rejections, suspensions, and reactivations.
- `src/health/` — `HealthController` providing `/health`, `/ready`, `/metrics`, and `/api/v1/vendors/health`.

## API Endpoints

- Merchant Endpoints (`AuthGuard`, `VendorMemberGuard`):
  - `POST /api/v1/vendors` — register vendor organization in DRAFT status.
  - `GET /api/v1/vendors/:vendorId` — get vendor details and business profile.
  - `PATCH /api/v1/vendors/:vendorId` — update vendor details or business profile.
  - `POST /api/v1/vendors/:vendorId/documents` — attach verification document media file.
  - `GET /api/v1/vendors/:vendorId/documents` — list attached documents.
  - `DELETE /api/v1/vendors/:vendorId/documents/:documentId` — remove attached document.
  - `POST /api/v1/vendors/:vendorId/submit-verification` — submit vendor for KYB verification.
  - `GET /api/v1/vendors/user/me` — list organizations where current user is owner or active member.

- Admin Endpoints (`AuthGuard`, `AdminGuard`):
  - `GET /api/v1/admin/vendors` — search and list vendors with pagination.
  - `GET /api/v1/admin/vendors/:vendorId` — full compliance view including history and documents.
  - `POST /api/v1/admin/vendors/:vendorId/approve` — approve verification and mark VERIFIED.
  - `POST /api/v1/admin/vendors/:vendorId/reject` — reject verification.
  - `POST /api/v1/admin/vendors/:vendorId/suspend` — suspend vendor account.
  - `POST /api/v1/admin/vendors/:vendorId/reactivate` — reactivate suspended vendor.
  - `PATCH /api/v1/admin/vendors/:vendorId/documents/:documentId` — review and accept/reject document.

## Kafka Events

- `vendor.registered`
- `vendor.verification.requested`
- `vendor.verified`
- `vendor.rejected`
- `vendor.suspended`
- `vendor.reactivated`
