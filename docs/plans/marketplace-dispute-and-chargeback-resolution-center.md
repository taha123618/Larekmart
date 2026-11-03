# Marketplace Dispute & Chargeback Resolution Center Implementation Plan

**Goal:** Deliver a production-grade, end-to-end Dispute & Chargeback Resolution Center across the Larekmart monorepo. This allows buyers and Stripe chargeback webhooks to initiate disputes, automatically freezes vendor escrow balances in `vendor-service`, gives sellers a time-limited rebuttal window with evidence upload, enables platform administrators to arbitrate and resolve claims, and automatically executes clawbacks or escrow unfreezes.

**Architecture:**

- **Domain Contracts & Database (`@repo/types`, `@repo/vendor-db`)**: Define `DisputeStatusEnum`, `DisputeTypeEnum`, `DisputeResolutionEnum`, and `VendorDispute` Prisma models with relational dispute timelines and evidence records.
- **Backend Microservices (`apps/vendor-service`, `apps/payment-service`)**:
  - `vendor-service`: Houses the core dispute state machine, rebuttal submission, and integration with `settlementsService.freezeEscrowOnDispute()` and `settlementsService.unfreezeEscrow()`.
  - `payment-service`: Ingests Stripe webhook dispute events (`charge.dispute.created`, `charge.dispute.closed`) and emits Kafka events to auto-freeze vendor funds.
- **Gateway Routing (`apps/api-gateway`)**: Routes authenticated buyer and seller dispute queries and role-guarded admin arbitration endpoints.
- **Customer & Seller Storefront (`apps/client`)**: Buyer "Report Issue / Open Dispute" flow on order details and Seller Dispute Center (`/account/seller/disputes`) with countdown rebuttal deadlines and evidence upload.
- **Admin Operations UI (`apps/admin`)**: Arbitration Workbench (`/disputes`) with side-by-side evidence inspection, audit history, and one-click dispute resolution actions.
- **Zero-Tolerance Quality**: Fully tested with standalone `tsx` suites, zero `any` / `@ts-ignore`, 100% strict TypeScript, and strict boundary isolation.

**Tech Stack:** NestJS 10 (Fastify), Hono 4, Next.js 16/15 (App Router), Prisma / PostgreSQL, Stripe API, Kafka, Redis, Tailwind CSS, Lucide Icons.

---

## Global Constraints

- Never use `any` or `@ts-ignore`.
- Derive buyer identity exclusively from verified Clerk session headers (`x-user-id`) supplied by API Gateway.
- Escrow mutations must be transactional and preserve balance invariants (`availableBalance + escrowBalance + disputeFrozenBalance + lifetimePaid = totalInflow`).
- Microservice internal endpoints must verify `x-internal-secret` in constant time.
- Standalone `tsx` test runners only (no Vitest / Jest).

---

## File Structure & Impact Surface

```
packages/
├── types/src/
│   ├── disputes.ts                 # Contracts, Zod schemas, enums, DTOs
│   └── index.ts                    # Re-export dispute contracts
├── vendor-db/prisma/
│   └── schema.prisma               # VendorDispute, VendorDisputeTimeline models
apps/
├── payment-service/src/routes/
│   └── webhooks.route.ts           # Stripe charge.dispute.created / closed webhook handling
├── vendor-service/
│   ├── src/modules/disputes/
│   │   ├── disputes.module.ts      # NestJS disputes module
│   │   ├── disputes.controller.ts  # Endpoints: create, list, details, rebuttal, resolve, cancel
│   │   └── disputes.service.ts     # Business logic, state transitions, escrow freeze/unfreeze
│   ├── src/app.module.ts           # Register DisputesModule
│   └── tests/
│       └── disputes.test.ts        # Standalone tsx integration & unit test suite
├── api-gateway/src/routing/
│   ├── authenticated.routes.ts     # Route /api/v1/disputes to vendor-service
│   └── admin.routes.ts             # Route /api/v1/admin/disputes to vendor-service
├── client/src/
│   ├── services/dispute.service.ts # API client for buyer & seller disputes
│   ├── app/account/orders/[id]/    # "Open Dispute" modal & active status indicator
│   └── app/account/seller/disputes/ # Seller Rebuttal & Dispute Resolution Dashboard
└── admin/src/
    ├── services/dispute.service.ts # Admin arbitration API client
    ├── app/(dashboard)/disputes/   # Admin Arbitration Workbench
    └── components/Sidebar.tsx      # Navigation link to Disputes
```

---

## Tasks & Architectural Milestones

### Task 1: Domain Contracts & Database Models (`@repo/types` & `@repo/vendor-db`)

- Created `packages/types/src/disputes.ts` and exported from `packages/types/src/index.ts`.
- `DisputeStatusEnum`: `OPENED`, `UNDER_REVIEW`, `EVIDENCE_REQUESTED`, `EVIDENCE_SUBMITTED`, `ARBITRATION`, `RESOLVED_BUYER_FAVOR`, `RESOLVED_SELLER_FAVOR`, `CANCELLED`
- `DisputeTypeEnum`: `ITEM_NOT_RECEIVED`, `DAMAGED_OR_DEFECTIVE`, `SIGNIFICANTLY_NOT_AS_DESCRIBED`, `WRONG_ITEM_SENT`, `STRIPE_CHARGEBACK`, `UNAUTHORIZED_TRANSACTION`
- Added `VendorDispute` and `VendorDisputeTimeline` models in `packages/vendor-db/prisma/schema.prisma` with relations to `Vendor` and `VendorEscrowLedger`.
- Unit test suite: `packages/types/tests/disputes.test.ts`.

### Task 2: Stripe Chargeback Webhook Handlers (`apps/payment-service`)

- In `apps/payment-service/src/routes/webhooks.route.ts`:
  - Listens to `charge.dispute.created` and `charge.dispute.closed`.
  - Dispatches Kafka `payment.dispute.created` and `payment.dispute.closed` events with payload containing `{ stripeDisputeId, chargeId, paymentIntentId, amount, currency, reason, status }`.

### Task 3: Core Dispute Service & State Machine (`apps/vendor-service`)

- `apps/vendor-service/src/modules/disputes/`:
  - `createDispute()`: Validates order and vendor, freezes related escrow item via `settlementsService.freezeEscrowOnDispute()`, sets 7-day rebuttal deadline.
  - `submitRebuttal()`: Validates seller ownership, verifies deadline, transitions state to `EVIDENCE_SUBMITTED` / `ARBITRATION`.
  - `resolveDispute()`: Admin arbitration. If `BUYER_FAVOR`, claws back escrow/balance and emits `dispute.resolved.buyer_favor`. If `SELLER_FAVOR`, unfreezes escrow to available balance.
  - Integration test suite: `apps/vendor-service/tests/disputes.test.ts`.

### Task 4: API Gateway Routing (`apps/api-gateway`)

- Proxies `/api/v1/disputes` to `vendor-service` with verified `x-user-id` and role claims.
- Proxies `/api/v1/admin/disputes` to `vendor-service` with admin role enforcement.

### Task 5: Customer Storefront & Order Dispute UI (`apps/client`)

- Customer order details dispute trigger with evidence upload.
- Active Dispute Timeline tracker with step progression.

### Task 6: Seller Portal Rebuttal Dashboard (`apps/client`)

- `/account/seller/disputes`: Filterable table with deadline countdown and evidence rebuttal modal.

### Task 7: Admin Arbitration Workbench (`apps/admin`)

- `/disputes`: Side-by-side buyer evidence vs seller rebuttal inspection with one-click resolution.
