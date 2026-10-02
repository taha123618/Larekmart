# Synthesized Requirements

## REQ-CLI-01: Product Discovery & Catalog Browsing
- source: `docs/PRD.md` (PRD-CLI-01)
- scope: Customer Storefront (`apps/client`)
- requirement: Users can browse the full product catalog with responsive image galleries, pricing, category badges, and dynamic URL query parameter filtering (`?category=...&sort=...&search=...`).

## REQ-CLI-02: Product Detail & Variant Selection
- source: `docs/PRD.md` (PRD-CLI-02)
- scope: Customer Storefront (`apps/client`)
- requirement: Dedicated product page (`/products/[id]`) showing multi-angle images, full description, size selector (`S`, `M`, `L`, `XL`), and color swatches with interactive image switching.

## REQ-CLI-03: Persistent Shopping Cart
- source: `docs/PRD.md` (PRD-CLI-03)
- scope: Customer Storefront (`apps/client`) & `cart-service`
- requirement: Client-side persistent shopping cart (`localStorage` + `cart-service` MongoDB sync) supporting item additions with variants, quantity updates, and cart badge indicator.

## REQ-CLI-04: Stripe Custom Checkout Experience
- source: `docs/PRD.md` (PRD-CLI-04)
- scope: Customer Storefront (`apps/client`) & `payment-service`
- requirement: Embedded custom Stripe Checkout element powered by `payment-service` session tokens, with payment verification return page and redirect to order confirmation receipt (`/orders`).

## REQ-ADM-01: Executive Analytics Dashboard
- source: `docs/PRD.md` (PRD-ADM-01)
- scope: Admin Portal (`apps/admin`) & `analytic-service`
- requirement: Operations portal displaying real-time revenue, order volume, recent transactions, customer counts, and visual trend charts.

## REQ-ADM-02: Product Catalog & Category Management
- source: `docs/PRD.md` (PRD-ADM-02)
- scope: Admin Portal (`apps/admin`) & `product-service`
- requirement: Admin CRUD interfaces to create, update, price, and categorize products, manage stock status, and upload product imagery.

## REQ-ADM-03: Order Processing & Status Tracking
- source: `docs/PRD.md` (PRD-ADM-03)
- scope: Admin Portal (`apps/admin`) & `order-service`
- requirement: Real-time order list with status filtering (`pending`, `paid`, `processing`, `shipped`, `delivered`, `canceled`), customer details, line items, and audit logs.
