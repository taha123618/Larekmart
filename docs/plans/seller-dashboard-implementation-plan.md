# LarekMart Seller Dashboard Implementation Plan (`apps/seller`)

## Executive Summary

The **LarekMart Seller Dashboard** (`apps/seller`) provides a modern, responsive, and secure marketplace seller management portal inspired by Amazon Seller Central, Alibaba Seller Center, and Daraz Seller Center. Built with **Nuxt 3**, **Vue 3**, **TypeScript**, **Tailwind CSS v4**, **Nuxt UI**, and **TanStack Vue Query**, it integrates natively with Larekmart's microservices ecosystem through the unified API Gateway.

---

## 1. Architecture & Technology Stack

| Layer | Technology | Selection Rationale |
|---|---|---|
| **Framework** | Nuxt 3 (Vue 3, Vite, Nitro) | Universal SSR/ISR, file-based routing, server engine for secure auth sessions |
| **Design System** | Tailwind CSS v4 + Nuxt UI (Reka UI) | Accessible primitives, dark/light theme tokens, responsive layouts |
| **State Management** | Pinia + TanStack Vue Query v5 | Separation of client UI state (sidebar, active store) and server state (caching, optimistic updates) |
| **Real-Time** | Socket.IO Client 4.8 | Low-latency bi-directional messaging for buyer-seller chat and presence |
| **Visualization** | Apache ECharts 5.6 + GSAP 3.15 | Hardware-accelerated charts and smooth UI interaction animations |
| **Forms & Validation** | VeeValidate 4 + Zod | Schema-based declarative validation matching backend contract schemas |
| **Testing** | Vitest + Nuxt Test Utils | Component and unit test execution |
| **Containerization** | Docker (Alpine multi-stage) | Hardened DHI compliant image running as unprivileged user |

---

## 2. Six Pillars Feature Service Delivery Compliance

### Pillar 1 — Front-End Delivery (`apps/seller/*`)
- **Full UI Coverage**: Delivered 20+ pages spanning Onboarding (4-step KYB wizard), Dashboard with operating status notices, Catalog/Products, Inventory, Orders & Fulfillment, Finance & Payouts, Messaging, Support Tickets, Customer Reviews & Rating Responses, Store Marketing & Promotions, Account Health & Security Benchmarks, and Store Settings (staff invitations, policies, storefront customization).
- **Responsive Layout**: Collapsible desktop sidebar with GSAP animation, mobile sliding drawer, breadcrumbs, search, notifications, and multi-seller store switcher.
- **Design Tokens**: Standardized semantic badges (`ACTIVE`, `PENDING`, `SUSPENDED`, `REJECTED`, etc.), stats cards, data tables, empty states, and loading skeletons.

### Pillar 2 — Cross-Service & Gateway Integration
- **Gateway Reverse Proxying**: Routes configured in `apps/api-gateway` with CORS origin enabled for `http://localhost:3004`.
- **Identity & Roles**: Propagates Clerk session Bearer tokens; API Gateway injects `x-user-id`, `x-user-role`, and `x-user-is-seller`.
- **Service Endpoints Integrated**:
  - `seller-service`: Storefront metadata, operational settings, staff members, policies, performance metrics.
  - `vendor-service`: Legal entity profile, business verification (KYB).
  - `product-service`: Product creation, catalog browsing, category associations.
  - `inventory-service`: Stock ledger, thresholds, reservations.
  - `order-service`: Order status, fulfillment tracking, customer order history.
  - `payout-service`: Available balance, settlement statements, payout requests.
  - `chat-service`: Real-time buyer-seller messaging over Socket.IO.
  - `support-service`: Ticket filing, dispute inquiries.

### Pillar 3 — Documentation, Skills, Manifests & Configuration
- **Manifests**: Added `seller` container to `docker-compose.yml`, created Kubernetes deployment `infrastructure/kubernetes/base/frontends/seller.yaml`, and updated `kustomization.yaml`.
- **CI/CD Pipelines**: Matrix updated in `.github/workflows/reusable-docker-build.yml`, rolling updates and automated rollback handlers added to `staging.yml` and `production.yml`.
- **Agent Instructions**: Created scoped `apps/seller/AGENTS.md` and updated root `AGENTS.md`.

### Pillar 4 — Deep Analysis & Comprehensive Testing
- **Unit Testing**: Vitest test suite (`apps/seller/tests/unit/components.spec.ts`, `schemas.spec.ts`, `stores.spec.ts`, `api.spec.ts`) validating component rendering, status badge variants, stats card formatting, form schemas, Pinia stores, and API error normalization with a 100% pass rate (14/14 tests passing).
- **Type Safety**: Passed `pnpm --filter seller check-types` (`tsc --noEmit`) with 0 errors.
- **Production Build**: Verified with `pnpm --filter seller build` generating hardened client and Nitro SSR server bundles.

### Pillar 5 — Security Audit & Zero-Trust Hardening
- **Client Identity Defense**: Client-supplied claim headers stripped at API Gateway; user identity verified cryptographically via Clerk Bearer tokens.
- **Role-Based Isolation**: Staff permissions (`OWNER`, `ADMIN`, `MANAGER`, `STAFF`, `VIEWER`) enforced by backend microservices.
- **Feature Flag Gating**: `isSeller` platform toggle respected at route middleware level (`seller-access.ts`), preventing unauthorized dashboard access when feature is disabled.

### Pillar 6 — Global Architecture & Monorepo Sync
- Monorepo workspace map in root `README.md` and `AGENTS.md` updated to document `apps/seller` at port 3004.
