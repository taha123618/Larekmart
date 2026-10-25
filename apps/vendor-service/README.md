# Larekmart Vendor Service

Multi-tenant vendor service managing legal business identities, organization profiles, KYB (Know Your Business) verification and approval workflows, compliance document management, authorized representatives, and vendor lifecycle states.

---

## 1. Overview & Architecture

- **Port**: `8020` (via API Gateway `:8080`)
- **Runtime**: Node.js 22 + TypeScript + NestJS 10 (Fastify engine)
- **ORM / Database**: Prisma Client via `@repo/vendor-db` + PostgreSQL (`larekmart_vendor_db` or `vendor_db`)
- **Caching**: Redis namespace `vendor:v1:*`
- **Event Bus**: Apache Kafka via `@repo/kafka`
- **Authentication**: Clerk JWTs (`x-user-id`, `x-user-role`) and internal gateway secret (`x-internal-secret`)

The vendor service owns the legal organization and corporate compliance identity, distinct from the marketplace storefronts owned by `seller-service`.

---

## 2. Database Schema (`@repo/vendor-db`)

Six relational tables persisted in PostgreSQL via Prisma:

| Table                      | Purpose                                                                                                                                 |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `vendors`                  | Legal organization entity (legal name, registration number, tax ID, country, lifecycle status).                                         |
| `vendor_business_profiles` | Corporate headquarters address, industry category, website, and authorized representative details.                                      |
| `vendor_documents`         | Business registration, tax certificates, director IDs, and bank statements linked to `media-service`.                                   |
| `vendor_verifications`     | KYB workflow executions, review notes, risk scores, and admin audit decisions.                                                          |
| `vendor_members`           | Organization staff membership with granular role assignments (`OWNER`, `ADMIN`, `COMPLIANCE_OFFICER`, `MEMBER`).                        |
| `vendor_status_history`    | Immutable transition log of organizational states (`DRAFT`, `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`, `SUSPENDED`, `TERMINATED`). |

---

## 3. API Endpoints

### Merchant Endpoints (`AuthGuard`, `VendorMemberGuard`)

- `POST /api/v1/vendors` — Register vendor organization and legal business profile.
- `GET /api/v1/vendors/user/me` — List all vendor organizations where the authenticated user is owner or active member.
- `GET /api/v1/vendors/:vendorId` — Retrieve vendor legal identity, compliance status, documents, and members.
- `PATCH /api/v1/vendors/:vendorId` — Update legal name, trade name, tax ID, or business address.
- `POST /api/v1/vendors/:vendorId/submit-verification` — Submit organization for KYB verification review.
- `POST /api/v1/vendors/:vendorId/documents` — Attach verification document uploaded through `media-service`.
- `GET /api/v1/vendors/:vendorId/documents` — List attached compliance verification documents.
- `DELETE /api/v1/vendors/:vendorId/documents/:documentId` — Remove a pending compliance document.

### Marketplace Administration (`AdminGuard`)

- `GET /api/v1/admin/vendors` — List all vendors with pagination, country, and status filters.
- `GET /api/v1/admin/vendors/:vendorId` — Inspect complete vendor corporate dossier, verifications, and history.
- `POST /api/v1/admin/vendors/:vendorId/approve` — Approve KYB verification and mark vendor as `VERIFIED`.
- `POST /api/v1/admin/vendors/:vendorId/reject` — Reject KYB verification with documented deficiency reasons.
- `POST /api/v1/admin/vendors/:vendorId/suspend` — Suspend vendor account with mandatory compliance reason.
- `POST /api/v1/admin/vendors/:vendorId/reactivate` — Reactivate a previously suspended vendor.
- `POST /api/v1/admin/vendors/:vendorId/documents/:documentId/review` — Review an individual compliance document (`ACCEPTED` or `REJECTED`).

### Health & Metrics

- `GET /health` / `GET /api/v1/vendors/health` — Readiness probe reporting database and Redis status.
- `GET /metrics` — Prometheus metrics (`vendor_service_up`, HTTP duration, Kafka emitter telemetry).

---

## 4. Kafka Event Contracts

Publishes events to Kafka following the `{ value: payload }` envelope convention:

| Topic                           | Trigger                                             | Consumers                                                                                           |
| :------------------------------ | :-------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `vendor.registered`             | New corporate entity registered in draft state.     | `email-service`, `analytic-service`, `notification-service`                                         |
| `vendor.verification.requested` | Merchant submits organization for KYB verification. | `analytic-service`, `notification-service`                                                          |
| `vendor.verified`               | Compliance admin approves KYB verification.         | `user-service` (sets `isSeller: true`), `email-service`, `analytic-service`, `notification-service` |
| `vendor.rejected`               | Compliance admin rejects KYB documentation.         | `email-service`, `analytic-service`, `notification-service`                                         |
| `vendor.suspended`              | Organization suspended for compliance failure.      | `email-service`, `analytic-service`, `notification-service`                                         |
| `vendor.reactivated`            | Suspended vendor organization restored.             | `email-service`, `analytic-service`, `notification-service`                                         |

---

## 5. Testing & Verification

Run tests from the repository root:

```bash
# Run standalone integration test suite
pnpm --filter vendor-service test

# Type-check
pnpm --filter vendor-service check-types

# Generate & deploy database schema
pnpm --filter @repo/vendor-db db:generate
pnpm --filter @repo/vendor-db db:migrate
```
