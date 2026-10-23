# Larekmart Seller Service

Marketplace seller service managing storefront configuration, custom merchant slugs & branding, seller staff & delegated permissions, operational settings, merchant policies, performance metrics, and seller lifecycle state management.

---

## 1. Overview & Architecture

- **Port**: `8021` (via API Gateway `:8080`)
- **Runtime**: Node.js 22 + TypeScript + Fastify 5
- **ORM / Database**: Drizzle ORM + PostgreSQL (`larekmart_seller_db` or `seller_db`)
- **Caching**: Redis namespace `seller:v1:*`
- **Event Bus**: Apache Kafka via `@repo/kafka`
- **Authentication**: Clerk JWTs via `x-user-id`, `x-user-role`, and API Gateway internal service signature (`x-internal-secret`)

The seller service owns the marketplace selling persona and public storefront presentation, distinct from the legal business organization owned by `vendor-service`.

---

## 2. Database Schema

Seven relational tables persisted in PostgreSQL via Drizzle ORM:

| Table                          | Purpose                                                                                                 |
| :----------------------------- | :------------------------------------------------------------------------------------------------------ |
| `sellers`                      | Root merchant account records linked to legal `vendor_id` and `primary_user_id`.                        |
| `seller_stores`                | Public storefront configuration (name, slug, headline, description, logos, banners, vacation mode).     |
| `seller_staff`                 | Delegated store team accounts with role-based access (`OWNER`, `MANAGER`, `CATALOG_SPECIALIST`, etc.).  |
| `seller_settings`              | Operational settings (currency, auto-accept orders, shipping origin postal code, low stock thresholds). |
| `seller_policies`              | Public merchant policies (`SHIPPING`, `RETURNS`, `PRIVACY`, `TERMS`).                                   |
| `seller_status_history`        | Immutable audit log of seller status transitions (`ONBOARDING`, `ACTIVE`, `SUSPENDED`, `INACTIVE`).     |
| `seller_performance_snapshots` | Service-level indicators (star rating, fulfillment rate, cancellation rate, response times).            |

---

## 3. API Endpoints

### Public Storefronts

- `GET /api/v1/storefronts/:slug` — Retrieve public storefront, banner, and store policies by custom URL slug (cached in Redis).
- `GET /api/v1/sellers/:sellerId/storefront` — Retrieve storefront configuration by seller ID.

### Merchant Operations (`requireUser`, `requireSellerStaffOrAdmin`)

- `POST /api/v1/sellers` — Onboard seller storefront linked to a verified vendor organization.
- `GET /api/v1/sellers/me` — List all seller storefronts owned by current user or where user is a staff member.
- `GET /api/v1/sellers/:sellerId` — Retrieve seller overview, operational status, and performance summary.
- `PATCH /api/v1/sellers/:sellerId` — Update seller account details (status, primary user ID).
- `PATCH /api/v1/sellers/:sellerId/storefront` — Update store name, slug, headline, description, banner, logo, vacation mode.
- `POST /api/v1/sellers/:sellerId/staff` — Add staff member with delegated role and permissions.
- `GET /api/v1/sellers/:sellerId/staff` — List staff members for store.
- `PATCH /api/v1/sellers/:sellerId/settings` — Update operational settings (currency, auto-accept orders, shipping origin).
- `PUT /api/v1/sellers/:sellerId/policies` — Upsert merchant policy (shipping, returns, terms, privacy).
- `GET /api/v1/sellers/:sellerId/performance` — View seller performance ratings and fulfillment metrics.

### Marketplace Administration (`requireAdmin`)

- `GET /api/v1/admin/sellers` — List all marketplace sellers with status filtering and search.
- `GET /api/v1/admin/sellers/:sellerId` — Inspect comprehensive seller details, linked vendor, store, staff, policies, and metrics.
- `POST /api/v1/admin/sellers/:sellerId/status` — Unified status transition with audit reason.
- `POST /api/v1/admin/sellers/:sellerId/activate` — Activate seller account.
- `POST /api/v1/admin/sellers/:sellerId/suspend` — Suspend seller account with policy violation reason.
- `GET /api/v1/admin/sellers/:sellerId/performance` — View historical performance snapshots.

### Health & Metrics

- `GET /health` / `GET /api/v1/sellers/health` — Readiness probe reporting database and Redis connectivity.
- `GET /metrics` — Prometheus metrics (`seller_service_up`, HTTP response duration, Kafka status).

---

## 4. Kafka Event Contracts

Publishes events to Kafka following the repository `{ value: payload }` envelope convention:

| Topic                       | Trigger                                         | Consumers                                                   |
| :-------------------------- | :---------------------------------------------- | :---------------------------------------------------------- |
| `seller.created`            | New seller storefront registered.               | `email-service`, `analytic-service`, `notification-service` |
| `seller.activated`          | Administrator approves/activates storefront.    | `email-service`, `analytic-service`, `notification-service` |
| `seller.updated`            | Store account details or status modified.       | `analytic-service`, `notification-service`                  |
| `seller.suspended`          | Store suspended for policy violations.          | `email-service`, `analytic-service`, `notification-service` |
| `seller.storefront.updated` | Store name, branding, or vacation mode updated. | `analytic-service`, `notification-service`                  |

---

## 5. Testing & Verification

Run tests from the repository root:

```bash
# Run standalone integration test suite
pnpm --filter seller-service test

# Type-check
pnpm --filter seller-service check-types

# Database migrations
pnpm --filter seller-service db:migrate
```
