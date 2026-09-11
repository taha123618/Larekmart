# Product Requirement Document (PRD) — Larekmart E-Commerce Platform

## 1. Product Overview

Larekmart is a modern clothing retail e-commerce platform consisting of two dedicated Next.js App Router frontends and six headless backend microservices.

- **Customer Storefront (`apps/client`)**: Clean, responsive, high-conversion apparel storefront.
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

## 4. Non-Functional Product Requirements

| Dimension                 | Requirement                                                              | Target Standard               |
| :------------------------ | :----------------------------------------------------------------------- | :---------------------------- |
| **Accessibility**         | Semantic HTML5, accessible form controls, ARIA states                    | WCAG 2.1 Level AA             |
| **Performance**           | Fast Largest Contentful Paint (LCP), optimized image formats (WebP/AVIF) | LCP < 1.5s, CLS < 0.05        |
| **Cross-Browser**         | Full functionality across modern evergreen browsers                      | Chrome, Safari, Firefox, Edge |
| **Mobile Responsiveness** | Touch-friendly controls, collapsible sidebars, adaptive data tables      | ≥ 320px to 4K displays        |
| **Dark / Light Theme**    | Theme provider with system preference auto-detection                     | Zero-flicker hydration        |
