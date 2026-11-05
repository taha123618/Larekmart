# Product Requirement Document (PRD) — Larekmart E-Commerce Platform

## 1. Product Overview

**Larekmart** is a production-grade microservices e-commerce platform for market place like: amazon,daraz,ALiexpress,ALibaba and other , consisting of two dedicated Next.js App Router frontends and headless backend microservices.

- **Customer Storefront (`apps/client`)**: Clean, responsive, high-conversion marketplace storefront.
- **Admin Management Portal (`apps/admin`)**: Operations hub for products, orders, customers, and analytics.

---

## 2. User Personas & Core Journeys

```
                                    Customer Journey
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ 1. Browse/Search │────▶│ 2. Product Detail│────▶│ 3. Add to Cart   │────▶│ 4. Stripe Pay    │
│  Filter Category │     │  Select Size/Clr │     │  Persistent Store│     │  Webhook Receipt │
└──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘

                                     Admin Journey
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ 1. Clerk Admin In│────▶│ 2. KPI Dashboard │────▶│ 3. Catalog Manage│────▶│ 4. Track Orders  │
│  Role Verification     │  Live Revenue/Ord│     │  Add/Edit/Upload │     │  Live Audit Logs │
└──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘

                                 Merchant / Seller Journey
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ 1. KYB Onboarding│────▶│ 2. Setup Store   │────▶│ 3. View Earnings │────▶│ 4. Receive Payout│
│  Vendor Approval │     │  List Products   │     │  Escrow Maturity │     │  Bank/Stripe ACH │
└──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 3. Product Features & Functional Requirements

### 3.1 Storefront Application (`apps/client`)

#### PRD-CLI-01: Product Discovery & Catalog Browsing

- **Description**: Users can browse the full product catalog with responsive image galleries, pricing, and category badges.
- **Filtering & Search**: Dynamic URL query parameter filtering (`?category=...&sort=...&search=...`) with instant UI updates.
- **Responsive Layout**: Fluid grid adapting seamlessly across mobile, tablet, and widescreen viewports.

#### PRD-CLI-02: Product Detail & Variant Selection

- **Description**: Dedicated product page (`/products/[id]`) showing multi-angle images, full description, size selector (`S`, `M`, `L`, `XL`), and color swatches.
- **Interactive State**: Real-time image switching based on selected color variant.

#### PRD-CLI-03: Persistent Shopping Cart

- **Description**: Client-side Zustand shopping cart with `localStorage` persistence (`cartStore.ts`).
- **Capabilities**: Add item with variant details, update quantity, remove item, display subtotal and item count badge in Navbar.

#### PRD-CLI-04: Stripe Custom Checkout Experience

- **Description**: Embedded custom Stripe Checkout element powered by `payment-service` session tokens.
- **Post-Payment Flow**: Polling return page verifying session status, auto-redirecting to order confirmation receipt (`/orders`).

---

### 3.2 Admin Management Dashboard (`apps/admin`)

#### PRD-ADM-01: Executive Analytics Dashboard

- **Live KPI Metrics**: Real-time summary cards (Total Revenue, Total Orders, Active Users, Catalog Size) powered by `analytic-service`.
- **Trend Charts**:
  - 7-Day Revenue & Orders area chart.
  - 6-Month Sales bar chart from `order-service`.
  - Platform event distribution pie chart.
- **Live Activity Stream**: Real-time event stream (`payment.successful`, `order.created`, `user.created`).

#### PRD-ADM-02: Product & Category Management

- **Data Table**: TanStack Table with sorting, filtering, and pagination for products and categories.
- **Mutations**: Side-sheet modal forms for creating and editing products with image uploads directly to Cloudinary.
- **Validation**: Strict schema validation using React Hook Form + Zod (`ProductFormSchema`, `CategoryFormSchema`).

#### PRD-ADM-03: User Administration

- **Capabilities**: List, inspect, create, and delete users via `auth-service` Clerk backend proxy.

#### PRD-ADM-04: Order & Transaction History

- **Capabilities**: Searchable order ledger with customer email, line items, status badge (`success | failed`), and timestamps.

---

### 3.3 Marketplace Commission Management (`apps/commission-service`)

#### PRD-COM-01: Tiered Commission Plans & Rules

- **Description**: Administrators can configure flexible marketplace commission plans with tiered percentage and fixed fees, minimum floor caps, and maximum ceiling caps.
- **Hierarchical Precedence**: Fee resolution strictly honors precedence: `PRODUCT` > `SELLER` > `CATEGORY` > `GLOBAL`.
- **High-Precision Calculations**: Computations execute with `Decimal.js` to eliminate binary floating-point drift.

#### PRD-COM-02: Rule Versioning & Snapshot Immutability

- **Description**: Every modification to a commission rule creates an immutable `commission_rule_versions` record.
- **Audit Trail**: Calculation snapshots pin the exact rule version utilized during order checkout, preventing subsequent rule adjustments from retroactively modifying historic settlements.

#### PRD-COM-03: Real-Time Order Settlement Quotes

- **Description**: Exposes real-time quote calculation (`POST /api/v1/internal/commissions/quote`) generating comprehensive line-item fee breakdowns during cart estimation and checkout confirmation.

---

### 3.4 Seller Payout & Double-Entry Ledger (`apps/payout-service`)

#### PRD-PAY-01: Balanced Double-Entry Financial Ledger

- **Description**: Authoritative financial journal (`ledger_entries`) recording all seller balance credits, commission deductions, dispute holds, and disbursements.
- **Zero-Sum Transaction Invariant**: Every transaction strictly satisfies `SUM(debit) == SUM(credit)`. Available balances are dynamically queried (`SUM(credit) - SUM(debit)`).

#### PRD-PAY-02: Escrow Maturity & Holding Periods

- **Description**: Funds from delivered orders are placed on escrow hold until return windows elapse, after which funds transition automatically to `AVAILABLE_PAYOUT`.
- **Dispute Reserve Holds**: Provides administrative ability to freeze disputed balances to safeguard marketplace integrity.

#### PRD-PAY-03: Settlement Batches & Disbursement Scheduling

- **Description**: Scheduled batch execution (`POST /api/v1/internal/payouts/schedule`) aggregating mature balances and dispatching disbursements to seller bank accounts or Stripe Connect accounts.

#### PRD-PAY-04: Provider Reconciliation & Financial Statements

- **Description**: Ingests external bank/Stripe webhook events to confirm or fail transfers, generating downloadable monthly seller reconciliation statements.

---

### 3.5 Customer Support & SLA Resolution Center (`apps/support-service`, `apps/client`, `apps/admin`)

#### PRD-SUP-01: Storefront Customer Support Portal (`apps/client`)

- **Description**: Customers can submit, track, and reply to support tickets directly from the storefront (`/support`, `/account/support`).
- **Entity Linking**: Tickets link directly to customer orders, products, returns, and dispute workflows.
- **Real-Time Updates**: Instant message delivery and status transitions via Socket.IO events.

#### PRD-SUP-02: Omnichannel Support Dashboard & Queue Operations (`apps/admin`)

- **Agent Queues**: Centralized operational queue with SLA deadline tracking, status filters (`OPEN`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`, `RESOLVED`, `CLOSED`), and priority badges (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- **Confidential Internal Notes**: Support agents can post internal notes (`isInternal: true`) that are strictly excluded from customer views.
- **SLA Policy Engine**: Automatically evaluates SLA targets based on category and priority, alerting on impending breaches.
- **Support Analytics**: Live metrics for total tickets, SLA compliance rate, average resolution time, and agent workload breakdown.

---

## 4. Non-Functional Product Requirements

| Dimension                 | Requirement                                                              | Target Standard               |
| :------------------------ | :----------------------------------------------------------------------- | :---------------------------- |
| **Accessibility**         | Semantic HTML5, accessible form controls, ARIA states                    | WCAG 2.1 Level AA             |
| **Performance**           | Fast Largest Contentful Paint (LCP), optimized image formats (WebP/AVIF) | LCP < 1.5s, CLS < 0.05        |
| **Cross-Browser**         | Full functionality across modern evergreen browsers                      | Chrome, Safari, Firefox, Edge |
| **Mobile Responsiveness** | Touch-friendly controls, collapsible sidebars, adaptive data tables      | ≥ 320px to 4K displays        |
| **Dark / Light Theme**    | Theme provider with system preference auto-detection                     | Zero-flicker hydration        |
