# LarekMart — Deep Architectural Analysis & Testing Blueprint for apps/seller

## 1. System Architecture Overview

The **Larekmart Seller Dashboard** (`apps/seller`, port `3004`) is the third primary frontend application within the Larekmart monorepo, joining the Customer Storefront (`apps/client`, port `3002`) and Admin Management Dashboard (`apps/admin`, port `3003`).

### 1.1 Technology Stack & Architectural Positioning

```
                                  [ Ingress / Traefik / NGINX ]
                                                │
                     ┌──────────────────────────┼──────────────────────────┐
                     │ :3002                    │ :3003                    │ :3004
              ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
              │ apps/client  │           │  apps/admin  │           │ apps/seller  │
              │  (Next.js)   │           │  (Next.js)   │           │   (Nuxt 3)   │
              └──────┬───────┘           └──────┬───────┘           └──────┬───────┘
                     │                          │                          │
                     └──────────────────────────┼──────────────────────────┘
                                                ▼
                                    [ apps/api-gateway (:8080) ]
                                    (Fastify 5, Clerk RS256 Auth,
                                     Timing-safe Internal Secret)
                                                │
                     ┌──────────────────────────┼──────────────────────────┐
                     ▼                          ▼                          ▼
             apps/seller-service        apps/vendor-service       apps/payout-service
                  (:8021)                    (:8020)                    (:8023)
                     │                          │                          │
                     └──────────────────────────┼──────────────────────────┘
                                                ▼
                                  [ Apache Kafka Event Bus ]
                                     (Topics: seller.*,
                                      vendor.*, order.*,
                                      payout.*, chat.*)
```

- **Runtime & Framework**: Nuxt 3 (SSR + Nitro), Vue 3.5 Composition API with `<script setup lang="ts">`.
- **UI Components & Design System**: Nuxt UI 3, Reka UI primitives, Tailwind CSS v4 design tokens with full light/dark mode support.
- **State Architecture**:
  - **Pinia**: Client-side UI state (`ui.store.ts`), active merchant workspace switching (`seller.store.ts`), and session hydration (`auth.store.ts`).
  - **TanStack Vue Query**: Authoritative server-side state, caching, query invalidation, and mutations (`useProducts`, `useOrders`, `useSeller`, `useSupport`).
- **Data Visualization & Motion**: Apache ECharts for GMV, order volume, and payout analytics; GSAP 3 with `prefers-reduced-motion` compliance.
- **Real-Time Communication**: Socket.IO client (`socket.client.ts`) connected to `chat-service` (:8026) and `notification-service` (:8005).

---

## 2. Microservice Domains & Multi-Tenant Data Scoping

The seller dashboard interfaces with 12 distinct backend microservices through the Fastify API Gateway. Each service enforces strict multi-tenant authorization boundaries:

| Microservice | Path & Port | Scope & Responsibility | Isolation & Security Guarantee |
| :--- | :--- | :--- | :--- |
| **`seller-service`** | `:8021` / `POST/GET /api/v1/sellers` | Storefront branding, settings, staff RBAC, policies. | Super admin delegations & store owner verification. |
| **`vendor-service`** | `:8020` / `GET/POST /api/v1/vendors` | Legal entities, KYB verification, documents. | Users can only access vendors where `userId === vendor.userId`. |
| **`product-service`** | `:8000` / `/api/v1/products` | Catalog CRUD, variants, pricing, media links. | Multi-vendor ownership: `product.sellerId === req.userId` (SEC-02). |
| **`order-service`** | `:8001` / `/api/v1/orders` | Order items, fulfillment status, dispatch tracking. | Handlers filter order items by authenticated `sellerId`. |
| **`inventory-service`** | `:8007` / `/api/v1/inventory` | Stock on hand, reservations, low-stock alerts. | Enforces `shouldBeSellerOrAdmin` via verified gateway headers. |
| **`payout-service`** | `:8023` / `/api/v1/sellers/me/payouts` | Balance ledger, escrow holds, payout requests. | Seller-scoped balance ledger preventing cross-tenant leakage. |
| **`commission-service`**| `:8022` / `/api/v1/commissions` | Category fee rates, minimums, fixed transaction fees. | Read-only commission rate quotes per product category. |
| **`review-service`** | `:8014` / `/api/v1/reviews` | Product ratings, buyer feedback, verified badges. | Sellers can only submit replies to reviews on their own products. |
| **`chat-service`** | `:8026` / `/api/v1/chat` | Real-time buyer-seller messaging, read receipts. | Participant verification: sender must be buyer or store seller. |
| **`support-service`** | `:8025` / `/api/v1/support/tickets` | Merchant support tickets, SLA tracking, escalations. | Scoped to `userId` and filtered by `source: SELLER`. |
| **`promotion-service`**| `:8016` / `/api/v1/promotions` | Seller coupons, campaigns, discount eligibility. | Promotion ownership scoped by seller ID and campaign budget. |
| **`media-service`** | `:8013` / `/api/v1/media` | Image uploads, CDN variants, format optimization. | Upload tokens verified; soft deletes on product deletion. |

---

## 3. Threat Modeling & Security Architecture

1. **Zero-Trust Perimeter Stripping**:
   All incoming requests via `apps/api-gateway` strip client-supplied headers (`x-user-id`, `x-user-role`, `x-user-is-seller`). Identity is derived strictly from cryptographic verification of Clerk Bearer RS256 JWT tokens.
2. **Timing-Safe Shared Secrets**:
   Internal service-to-service communication is validated using `safeTimingCompare` / `crypto.timingSafeEqual` against `x-internal-secret` to eliminate timing side-channel attacks.
3. **IDOR & Multi-Tenant Prevention**:
   Every mutation (`PATCH /products/:id`, `PATCH /orders/:id`, `POST /reviews/:id/reply`) validates that the targeted entity's `sellerId` strictly matches the verified session seller ID.
4. **Onboarding Chicken-and-Egg Resolution**:
   New merchants without `isSeller: true` in their initial Clerk token are permitted to create their initial seller entity if a valid verified `vendorId` is supplied, preventing an onboarding deadlock while retaining strict authorization.

---

## 4. Test Strategy & Quality Verification Matrix

To ensure absolute production stability, comprehensive test suites are partitioned into:

```
apps/seller/tests/
├── unit/
│   ├── api.spec.ts                     # API error normalization & status codes
│   ├── auth-store.spec.ts              # Session lifecycle, token storage, SSR hydration
│   ├── components.spec.ts              # UI badges, metric cards, status formatters
│   ├── navigation.spec.ts              # RBAC route visibility & breadcrumb generators
│   ├── orders-lifecycle.spec.ts        # Transition matrix, tracking validation, commissions
│   ├── product-calculations.spec.ts    # Margins, discounts, variant matrix & SKU generation
│   ├── schemas.spec.ts                 # Zod validation schemas for products & vendors
│   ├── stores.spec.ts                  # UI & Seller workspace Pinia store actions
│   └── utils.spec.ts                   # Date/currency formatters & RBAC helpers
└── integration/
    ├── finance-settlement-workflow.spec.ts # Escrow holds, balances, payout calculations
    ├── onboarding-workflow.spec.ts         # 4-stage onboarding state transitions
    ├── reviews-moderation-workflow.spec.ts # Review stats, star distributions, seller replies
    ├── seller-workflows.spec.ts            # Core multi-tenant workspace & order workflows
    └── support-chat-workflow.spec.ts       # Ticket SLAs, Socket.IO envelopes, unread counts
```
