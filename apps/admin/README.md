# Admin Dashboard (`apps/admin`)

The enterprise administrator management console for Larekmart, providing 360° observability, catalog management, multi-tenant marketplace governance, logistics dispatch, finance settlements, dispute arbitration, and Kafka event streaming resilience.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **UI & Styling**: Tailwind CSS v4, shadcn/ui, Radix UI primitives, Lucide icons
- **State & Data Fetching**: TanStack Table v9, TanStack React Query v5, React Hook Form + Zod
- **Charts & Telemetry**: Recharts
- **Auth**: Clerk (`@clerk/nextjs` v7 with role-based metadata access control)
- **Real-Time**: Native WebSockets via API Gateway (`NotificationBell`)
- **Port**: `3003`

---

## 32 Core Management Modules

### 1. Executive Overview & Platform Health
- **Executive Dashboard** (`/`): Real-time KPI summary cards, monthly order volume vs. success charts (`AppBarChart`), daily revenue and order velocity (`AppAreaChart`), activity distribution (`AppPieChart`), operational to-do manager with persistent storage (`TodoList`), and latest transaction stream (`CardList`).
- **Kafka DLQ & Resilience** (`/kafka-dlq`): Dead-letter queue inspection, OpenSearch error query log, partition backlog charts, and transactional replay dispatch.
- **Synthetic Canary Health** (`/system-health`): Automated synthetic health probes across all 28 microservices, SLA latency histograms, and status badges.
- **Feature Flags & Experiments** (`/feature-flags`): Real-time flag toggles, canary rollout percentages, kill switches, and targeted user overrides.
- **Cache Performance** (`/cache`): Real-time Redis cache hit/miss/error telemetry scraped from Prometheus `/metrics` across all caching services, ranked by error rate.

### 2. Product Catalog & Merchandising
- **Product Management** (`/products`): Full product CRUD, search index rebuild (`POST /products/backfill-search`), variant matrices, and Cloudinary media uploads.
- **Read-Optimized Catalog** (`/catalog`): Read-side storefront projection, brand listings, collection taxonomies, and subcategory hierarchies.
- **Inventory & Warehouse Stock** (`/inventory`): Multi-warehouse stock tracking, stock adjustments (`AdjustSheet`), restock logging (`RestockSheet`), and inventory initialization (`AddInventoryItemSheet`).
- **Low Stock Alerts** (`/inventory/low-stock`): Automatic threshold monitoring and restock triggers.
- **Stock Movement Ledger** (`/inventory/movements`): Append-only audit trail of stock adjustments, orders, and restocks.
- **Dynamic Pricing Engine** (`/pricing`): Multi-currency exchange rate tables, B2B/B2C price tiers, promotional quote composition, and pricing audit history.
- **Promotions & Coupons** (`/promotions`): Marketing campaign management, coupon generator, budget controls, discount rules, and redemption ledgers.

### 3. Sales, Orders & Logistics
- **Orders & Payments Registry** (`/orders`): Order lifecycle tracking, payment verification, fulfillment statuses, customer details, and live order actions (`AddOrder`).
- **Shopping Carts & Funnels** (`/carts`): Active cart sessions, guest-to-user merges, item reservations, and checkout funnel conversion metrics.
- **Shipping & Fulfillment** (`/shipping`): Carrier dispatch simulator (`CourierDispatcherSimulator`), real-time tracking, rate quote engine (TCS, Leopards, DHL, FedEx), and packing slips.
- **Returns & Exchanges** (`/returns`): RMA inspection modal (`InspectionModal`), approve/reject workflows (`ApproveRejectDialog`), partial return support, and Stripe refund retry execution.
- **Customer Wishlists** (`/wishlists`): Saved product registries, price drop alerts, and restock notification monitoring.

### 4. Marketplace & Vendor Governance
- **Vendors (Legal Entities)** (`/vendors`): KYB onboarding queue, business documentation audits, tax identification verification, and operational state transitions.
- **Vendor Verification Desk** (`/vendor-verification`): Document review, compliance approvals, and organization sanctions.
- **Seller Storefronts** (`/sellers`): Storefront configuration, seller policies, staff permissions, performance analytics, and Super Admin `isSellerEnabled` kill switches.
- **Marketplace Commissions** (`/commissions`): Commission rule builder, category fee tiers, fixed/percentage calculations, and fee forecast simulator.
- **Settlements & Escrow** (`/settlements`): Marketplace escrow holds, settlement batch schedules, balance ledgers, and payout reserve releases.
- **Seller Payouts** (`/payouts`): Double-entry ledger audit, disbursement status tracking, failed transfer retries, and Stripe Connect reconciliation.
- **Disputes & Arbitration** (`/disputes`): Buyer-vendor dispute cases, evidence inspection, escrow clawbacks, and arbitration desk decisions (`ArbitrationDrawer`).

### 5. Customer Care & Trust
- **Omnichannel Support** (`/support`): Support ticket queues, priority assignments, SLA policy monitors, customer timelines, and public/internal response threads.
- **AI Support Performance** (`/support/ai-performance`): AI agent resolution rates, deflection analytics, CSAT trends, and handoff latencies.
- **Live Chat Console** (`/chat`): Real-time customer support conversations, presence indicators, read receipts, and moderator message actions.
- **Product Reviews & Ratings** (`/reviews`): Verified purchase review moderation queue, abuse reports, rating recalculation, and approval actions.
- **Fraud & Anomaly Detection** (`/fraud`): Anomaly detection scorecards, velocity abuse flags, promotion abuse rules, and manual analyst case reviews.
- **Customers & Accounts** (`/users` & `/users/[id]`): Customer profiles, Clerk user management, seller status flags, saved addresses, and customer order history.
- **Taxes & Compliance** (`/taxes`): Nexus jurisdiction manager, tax category rules, customer exemptions, and tax calculation audit records.
- **Platform System Settings** (`/settings`): Super Admin delegations (`manage_sellers`), platform-wide switches, Kafka topology controls, and maintenance windows.

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Centralized API Gateway (Authoritative Single Entry Point for all services)
# Note: In production or containerized environments, these can also be configured
# dynamically at runtime via ADMIN_API_GATEWAY_URL and ADMIN_WS_URL.
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:8080
NEXT_PUBLIC_CLIENT_URL=http://localhost:3002
NEXT_PUBLIC_NOTIFICATION_WS_URL=ws://localhost:8080/ws
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
```

---

## Dynamic Runtime Configuration & Build-Lockout Elimination

The admin dashboard avoids compile-time environment variable lockouts:

1. **`/api/config` Endpoint**: Dynamically serves runtime endpoints (`ADMIN_API_GATEWAY_URL`, `ADMIN_WS_URL`, `NEXT_PUBLIC_API_GATEWAY_URL`) at request time.
2. **`RuntimeConfigProvider`**: Root layout provider in `src/app/layout.tsx` that hydrates runtime endpoints into client state.
3. **Dynamic Relative Routing & Next.js Rewrites**: In production behind a reverse proxy (Traefik/Ingress), routes default to relative paths (`""` -> `/api/v1/*`). In local development, `next.config.ts` rewrites `/api/v1/:path*` directly to the API Gateway.
4. **Resilient Next.js App Router Shell**:
   - `error.tsx`: Interactive error boundary preventing unhandled route crashes.
   - `loading.tsx`: Instant route transition skeleton indicators.
   - `not-found.tsx`: Branded 404 page routing administrators back to safety.

---

## Development & Verification Commands

```bash
# Start development server with Turbopack on :3003
pnpm --filter admin dev

# Type check with strict TypeScript
pnpm --filter admin check-types

# Production compilation of all 32 routes
pnpm --filter admin build

# Code quality and styling lint
pnpm --filter admin lint
```
