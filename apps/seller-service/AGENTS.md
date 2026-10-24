# AGENTS.md — apps/seller-service

Scope: `apps/seller-service` only. Root rules still apply — start there.

## What this service is

Fastify 5 microservice running on port 8021 using Drizzle ORM backed by PostgreSQL (`seller_db`), `@repo/redis` for caching, `@repo/kafka` for asynchronous event distribution, and `@repo/types` for contracts.
It provides storefront configuration (store name, slug, tagline, banner, logo, bio, policies), seller staff members and delegated permissions, marketplace operational settings, performance snapshots, and seller lifecycle state management.

**Crucial Separation of Concerns:**

- `vendor-service`: Owns legal/business organization identity, registration credentials, business profiles, KYB documents, compliance verification, and representative access controls.
- `seller-service`: Owns marketplace storefronts, store name/logo/banner, selling operations, seller staff, and marketplace settings. A single verified vendor organization may own one or more seller accounts.

## Architecture & Layers

- `src/index.ts` / `src/server.ts` — Server entrypoint and graceful shutdown.
- `src/app.ts` — Fastify application factory with CORS, defensive HTTP headers, and error handling.
- `src/config/env.ts` — Zod validated configuration (`PORT=8021`, `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `INTERNAL_SERVICE_SECRET`).
- `src/db/` —
  - `schema.ts`: Drizzle schema defining `sellers`, `seller_stores`, `seller_staff`, `seller_settings`, `seller_policies`, `seller_status_history`, and `seller_performance_snapshots`.
  - `connection.ts`: PostgreSQL connection pool and health check.
  - `migrate.ts`: Database migration script running DDL.
- `src/kafka/` — `producer.ts` publishing typed events using the `{ value: payload }` envelope.
- `src/services/` — `cache.service.ts` caching storefronts with Redis TTL and cache invalidation.
- `src/middleware/` —
  - `auth.middleware.ts`: `requireUser` (`x-user-id`), `requireAdmin` (`x-user-role === "admin"` or `x-internal-secret`), `requireSellerStaffOrAdmin`.
  - `error.middleware.ts`: Global error handler formatting standard `{ message, errors }` responses.
- `src/routes/` —
  - `health.routes.ts`: `/health`, `/ready`, `/metrics`, `/api/v1/sellers/health`.
  - `storefront.routes.ts`: Public `/api/v1/storefronts/:slug` and `/api/v1/sellers/:sellerId/storefront`.
  - `seller.routes.ts`: Merchant `/api/v1/sellers`, `/api/v1/sellers/me`, `/api/v1/sellers/:sellerId`, `/api/v1/sellers/:sellerId/storefront`, `/api/v1/sellers/:sellerId/staff`, `/api/v1/sellers/:sellerId/settings`, `/api/v1/sellers/:sellerId/policies`, `/api/v1/sellers/:sellerId/performance`.
  - `admin.routes.ts`: `/api/v1/admin/sellers`, `/api/v1/admin/sellers/:sellerId`, `/api/v1/admin/sellers/:sellerId/status`, `/api/v1/admin/sellers/:sellerId/activate`, `/api/v1/admin/sellers/:sellerId/suspend`, `/api/v1/admin/sellers/:sellerId/performance`.

## API Endpoints

- Public Storefront Endpoints:
  - `GET /api/v1/storefronts/:slug` — fetch storefront configuration and policies by slug.
  - `GET /api/v1/sellers/:sellerId/storefront` — fetch storefront configuration by seller ID.

- Merchant Endpoints (`requireUser`, `requireSellerStaffOrAdmin`):
  - `POST /api/v1/sellers` — register seller storefront linked to verified `vendorId`.
  - `GET /api/v1/sellers/me` — list all seller storefronts owned by current user or where user is a staff member.
  - `GET /api/v1/sellers/:sellerId` — get seller overview and operational status.
  - `PATCH /api/v1/sellers/:sellerId` — update seller account details (status, primary user).
  - `PATCH /api/v1/sellers/:sellerId/storefront` — update storefront name, slug, headline, banner, logo, vacation mode.
  - `POST /api/v1/sellers/:sellerId/staff` — add staff member with role and permissions.
  - `GET /api/v1/sellers/:sellerId/staff` — list staff members.
  - `PATCH /api/v1/sellers/:sellerId/settings` — update operational settings (currency, auto-accept orders, shipping origin).
  - `PUT /api/v1/sellers/:sellerId/policies` — upsert policy (shipping, returns, privacy, terms).
  - `GET /api/v1/sellers/:sellerId/performance` — view seller performance metrics and ratings.

- Admin Endpoints (`requireAdmin`):
  - `GET /api/v1/admin/sellers` — list all sellers across marketplace (filterable by `?status=`).
  - `GET /api/v1/admin/sellers/:sellerId` — get complete seller profile including store, staff, policies, and latest performance.
  - `POST /api/v1/admin/sellers/:sellerId/status` — transition seller status (`ACTIVE`, `SUSPENDED`, `INACTIVE`, `ONBOARDING`) with reason recording and Kafka event publishing. Restricted to **Super Admin** or **Manage Admin** (`requireManageAdmin`). Standard admins receive HTTP 403 `MANAGE_ADMIN_REQUIRED`.
  - `POST /api/v1/admin/sellers/:sellerId/activate` — activate seller account (`requireManageAdmin`).
  - `POST /api/v1/admin/sellers/:sellerId/suspend` — suspend seller account with reason (`requireManageAdmin`).
  - `GET /api/v1/admin/sellers/:sellerId/performance` — view seller performance metrics.
  - `GET /api/v1/system-settings` — public discovery endpoint returning platform-wide marketplace settings (`isSellerEnabled`).
  - `GET /api/v1/admin/system-settings` — read system governance settings (`requireAdmin`).
  - `PATCH /api/v1/admin/system-settings` — mutate project-wide seller functionality (`isSellerEnabled`). Strictly restricted to **Super Admin** (`requireSuperAdmin` / `x-user-is-super-admin`). Regular admins receive HTTP 403 `SUPER_ADMIN_REQUIRED`.
  - `GET /api/v1/admin/delegations` — list active admin verification delegations (`requireSuperAdmin`).
  - `POST /api/v1/admin/delegations` — grant `manage_sellers` authority to an admin (`requireSuperAdmin`).
  - `DELETE /api/v1/admin/delegations/:adminUserId` — revoke `manage_sellers` authority (`requireSuperAdmin`).

- Feature Guards & Access Control:
  - `requireSellerEnabled`: preHandler hook across all seller and public storefront routes. When `isSellerEnabled = false`, requests are halted immediately with HTTP 403 `SELLER_FEATURE_DISABLED`.
  - `requireSellerQualification`: verifies that the authenticated user has seller eligibility (`isSeller === true` or role `seller`). Non-qualified users receive HTTP 403 `SELLER_NOT_AUTHORIZED`.
  - `requireManageAdmin`: verifies that the caller is a Super Admin or has delegated `manage_sellers` authority (`x-user-can-manage-sellers: true`). Returns HTTP 403 `MANAGE_ADMIN_REQUIRED` to standard admins.

## Kafka Events

- `seller.created`
- `seller.activated`
- `seller.updated`
- `seller.suspended`
- `seller.storefront.updated`
