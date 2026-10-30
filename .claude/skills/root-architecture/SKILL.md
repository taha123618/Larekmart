---
name: root-architecture
description: Use when you need to understand Larekmart's overall system design, service responsibilities, how data flows between workspaces, or where a piece of functionality lives before making changes.
---

# Root architecture

**Larekmart** is a production-grade microservices e-commerce platform for market place like: amazon,daraz,ALiexpress,ALibaba and other , built in a pnpm + Turborepo
monorepo. This skill is the orientation map; deep detail is in `docs/ARCHITECTURE.md`.

## Mental model

- **Two frontends** own all user interaction and route through the centralized API Gateway:
  `client` (storefront, :3002) and `admin` (dashboard, :3003).
- **One API Gateway**:
  - `api-gateway` (:8080 / :8090) — Fastify 5 single public entrypoint reverse proxy, request correlation, Clerk session authentication, Redis rate limiting, circuit breaker, home aggregation (`/api/v1/home`), client header stripping, and internal secret injection.
- **Twenty-two HTTP backend services & one headless worker** own business logic and each owns its data:
  - `product-service` (:8000) — catalog, PostgreSQL via Prisma.
  - `order-service` (:8001) — orders, MongoDB via Mongoose.
  - `payment-service` (:8002) — Stripe; stateless.
  - `auth-service` (:8003) — Clerk user management; stateless.
  - `analytic-service` (:8004) — Go 1.22 (Chi), multithreaded Kafka ingestion (60+ topics), binary COPY batching (pgx.CopyFrom), atomic lock-free KPI counters, and REST metrics API.
  - `notification-service` (:8005) — Go (Chi), multi-channel notifications (Email, SMS, Push, In-App), PostgreSQL, Redis, WebSockets.
  - `search-service` (:8006) — Fastify, full-text product search, autocomplete, facets; OpenSearch + Redis cache.
  - `inventory-service` (:8007) — Hono, PostgreSQL stock authority, atomic reservations, warehouse inventory, and Kafka events.
  - `recommendation-service` (:8008) — Python 3.12+ (FastAPI), collaborative & content filtering, pgvector embeddings, trending algorithms, Celery worker.
  - `cart-service` (:8009) — Express 5, authoritative MongoDB carts, guest-to-user merge, pricing estimates, TTL expiration reaper.
  - `catalog-service` (:8010) — Fastify 5, read-optimized product discovery (categories, brands, collections) over a Prisma catalog read model.
  - `shipping-service` (:8011) — Koa, shipment lifecycle, carrier adapters (TCS/Leopards/DHL/FedEx), tracking, labels; PostgreSQL.
  - `user-service` (:8012) — Fastify 5, customer profiles, addresses, preferences; PostgreSQL via `@repo/user-db`.
  - `media-service` (:8013) — Hono 4, S3/MinIO object storage behind an `ObjectStorage` interface, Drizzle/PostgreSQL metadata, Redis-cached resolve, Sharp processing + cleanup workers.
  - `review-service` (:8014) — Fastify 5, product reviews, ratings, verified purchase checking, moderation, helpful voting, summary projections; PostgreSQL (`review_db`) via Drizzle ORM + Redis cache.
  - `wishlist-service` (:8015) — Fastify 5, saved products, multiple wishlists, guest-to-user merging, price drop & restock alerts; PostgreSQL (`larekmart_wishlist_db`) via Drizzle ORM + Redis cache.
  - `promotion-service` (:8016) — Hono 4, centralized promotions, coupons, discount eligibility, budgets, checkout reservations, redemptions; PostgreSQL (`larekmart_promotion_db`) via Drizzle ORM + Redis cache.
  - `tax-service` (:8017) — Fastify 5, jurisdiction-aware tax calculations, versioned tax rules, customer exemptions, checkout quotes, auditable snapshots, and provider adapters; MySQL (`tax_db`) via Drizzle ORM + Redis cache.
  - `return-service` (:8018) — Koa 2, multi-seller return & refund lifecycle orchestration: eligibility checks, partial-quantity returns, evidence media, warehouse inspection dispositions, return-shipment tracking, Stripe refund SAGA coordination, and transactional outbox; MySQL (`return_db`) via Drizzle ORM + Redis cache.
  - `pricing-service` (:8019) — Fastify 5, authoritative merchandise pricing, seller price lists (B2B & B2C), multi-currency conversion, tiered volume pricing, promotional discount composition, immutable quote snapshots, zero-drift Decimal.js engine, and audit history; PostgreSQL (`pricing_db`) via Drizzle ORM + Redis cache.
  - `vendor-service` (:8020) — NestJS 10 (Fastify), marketplace vendor registration, legal entities, KYB verification workflows, verification documents, and lifecycle status; PostgreSQL (`larekmart_vendor_db`) via `@repo/vendor-db` + Redis cache.
  - `seller-service` (:8021) — Fastify 5, marketplace storefront configuration, custom slugs & branding, seller staff & permissions, operational settings, performance snapshots, and seller events; PostgreSQL (`larekmart_seller_db`) via Drizzle ORM + Redis cache.
  - `email-service` — no HTTP; a Kafka worker that sends transactional email via Nodemailer.
- **Backend services never call each other over HTTP.** They integrate through Kafka
  topics (see `docs/EVENT-DRIVEN-ARCHITECTURE.md`).

## Where does X live?

| Need to change…                                            | Go to                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| Single entrypoint proxy, rate limits, routing, aggregation | `apps/api-gateway`                                     |
| Storefront UI/UX, cart, checkout                           | `apps/client`                                          |
| Admin tables, forms, charts                                | `apps/admin`                                           |
| Products/categories + product events                       | `apps/product-service`                                 |
| Orders, order analytics                                    | `apps/order-service`                                   |
| Stripe sessions, webhooks, Stripe sync                     | `apps/payment-service`                                 |
| User admin CRUD, `user.created`                            | `apps/auth-service`                                    |
| Notification orchestration, SMS, Push, In-App              | `apps/notification-service`                            |
| Emails for user/order events                               | `apps/email-service`                                   |
| Analytics ingestion, KPIs, daily aggregates                | `apps/analytic-service`                                |
| Product search, autocomplete, facets, indexing             | `apps/search-service`                                  |
| Inventory availability, reservations, stock ledger         | `apps/inventory-service`                               |
| AI recommendations, embeddings, user interactions          | `apps/recommendation-service`                          |
| Cart persistence, items, coupons, merge engine             | `apps/cart-service`                                    |
| Product discovery, categories, brands, collections         | `apps/catalog-service`                                 |
| Shipments, rates, tracking, carrier adapters               | `apps/shipping-service`                                |
| Customer profiles, addresses, preferences                  | `apps/user-service`                                    |
| Media uploads, variants, image processing                  | `apps/media-service`                                   |
| Product reviews, ratings, verified purchases, moderation   | `apps/review-service`                                  |
| Wishlists, saved products, guest merge, price-drop alerts  | `apps/wishlist-service`                                |
| Promotions, campaigns, coupons, discounts, budget holds    | `apps/promotion-service`                               |
| Tax calculation, rules, customer exemptions, audit logs    | `apps/tax-service`                                     |
| Returns, RMA, warehouse inspection, refund SAGA            | `apps/return-service`                                  |
| Merchandise pricing, price lists, multi-currency, quotes   | `apps/pricing-service`                                 |
| Marketplace vendors, legal entities, KYB verification      | `apps/vendor-service`                                  |
| Seller storefronts, staff permissions, seller settings     | `apps/seller-service`                                  |
| Kafka client/producer/consumer helpers                     | `packages/kafka`                                       |
| Shared types, Zod schemas, Kafka payload types             | `packages/types`                                       |
| Telemetry, structured logging, health checks               | `packages/monitoring`                                  |
| OpenSearch client, mappings, query builders                | `packages/opensearch`                                  |
| Redis facade, key namespaces, slot tagging, locks, leases  | `packages/redis`                                       |
| Product/category DB schema                                 | `packages/product-db`                                  |
| Inventory DB schema and transactions                       | `packages/inventory-db`                                |
| Order persistence schema                                   | `packages/order-db`                                    |
| Cart persistence schema (Mongoose)                         | `packages/cart-db`                                     |
| Catalog read-model schema and read-replica routing         | `packages/catalog-db`                                  |
| Shipping schema, tracking events, labels                   | `packages/shipping-db`                                 |
| User profiles, addresses, preferences schema               | `packages/user-db`                                     |
| Vendor business entity, KYB & member schema                | `packages/vendor-db`                                   |
| TS/ESLint baselines                                        | `packages/typescript-config`, `packages/eslint-config` |

## Data ownership

Each service owns its store; never reach into another service's database. Cross-service
consistency is achieved by publishing events and letting the consumer react (eventual
consistency). E.g. a product change in Postgres is mirrored to Stripe via
`product.created`/`product.deleted` and indexed in OpenSearch and vector embeddings.

## Key flows

1. **Checkout:** client `POST /sessions/create-checkout-session` → Stripe session →
   client confirms → Stripe `checkout.session.completed` webhook → payment-service
   publishes `payment.successful` → order-service persists an Order and publishes
   `order.created` → email-service sends an order email AND recommendation-service
   ingests purchase interactions for collaborative filtering.
2. **User creation:** admin `POST /users` → auth-service creates the Clerk user →
   publishes `user.created` → email-service sends a welcome email.
3. **Product creation:** admin `POST /products` → product-service writes Prisma →
   publishes `product.created` → payment-service creates a Stripe product,
   search-service upserts the OpenSearch document, AND recommendation-service computes vector embeddings.
4. **Storefront Personalization:** client queries `GET /api/v1/recommendations/home` (or category/recently-viewed) with Clerk `userId` → returns multi-strategy shelves → customer views/clicks dispatch zero-throw telemetry events.
5. **Cash on Delivery (COD) & Multi-Carrier Shipping:** client queries `shipping-service` (`GET /rates?city=...`) for live courier quotes (TCS, Leopards, DHL) → submits `POST /orders/cod` directly to `order-service` → order-service persists the COD Order and publishes `order.created` → `shipping-service` provisions shipment tracking.
6. **Promotion & Coupon Redemption:** client/cart queries `POST /api/v1/promotions/validate` or creates a hold via `POST /api/v1/promotions/reservations` → checkout submits with `reservationId` → on order creation (`order.created`) or payment (`payment.successful`), `promotion-service` commits redemption and emits `promotion.redeemed` → email-service sends notification, analytic-service aggregates discount KPIs.
7. **Jurisdiction-Aware Tax Calculation & Auditable Snapshots:** client cart/checkout queries `POST /api/v1/tax/quote` for real-time estimated sales tax/VAT → on order placement, client calls `POST /api/v1/tax/calculate` or `order-service` consumes `order.created` → `tax-service` persists immutable calculation snapshots with line rates and rule versions (`tax.calculation.completed`) → on item returns, `POST /api/v1/tax/returns/quote` calculates exact proportional tax adjustments.
8. **Return & Refund SAGA Lifecycle:** customer requests return via client (`POST /api/v1/returns/orders/:orderId`) with evidence media → `return-service` verifies return window & item policy → emits `return.requested` → admin/seller approves (`POST /api/v1/admin/returns/:id/approve`) → emits `return.approved` & `return.shipment.requested` → `shipping-service` generates reverse logistics label → warehouse inspects items (`POST /api/v1/admin/returns/:id/inspect`) → emits `return.inspection.completed` (restocking in `inventory-service`) & `return.refund.requested` → `payment-service` executes Stripe refund → emits `payment.refund.succeeded` → `return-service` marks return `COMPLETED`, emits `return.completed` → `order-service` marks order `refunded`, `analytic-service` tracks return metrics, and `email-service` delivers refund confirmation receipt.
9. **Merchant Onboarding, KYB Verification & Storefront Lifecycle:** merchant registers legal business profile (`POST /api/v1/vendors`) and uploads KYB documents via presigned media URLs → requests verification (`vendor.verification.requested`) → compliance admin reviews and approves (`POST /api/v1/admin/vendors/:id/verify`) → `vendor-service` emits `vendor.verified` → `user-service` consumes event and promotes user profile `isSeller: true` → merchant creates customer storefront (`POST /api/v1/sellers`) → `seller-service` emits `seller.created` → storefront goes live with custom slug and policies (`/stores/[slug]`) → `api-gateway` injects `x-user-is-seller: true` into authenticated requests, enabling seller portal actions and multi-vendor product listings.
10. **Read-Your-Writes Consistency & Read-Replica Bypass Leases:** When a client mutates state (`POST`, `PUT`, `PATCH`, `DELETE`), API Gateway registers an atomic 500ms Read-Your-Writes lease in Redis (`markReadYourWrites`) and injects `x-force-primary: true`. Downstream, `catalog-service` detects the lease via `databaseContext`, bypasses stale Redis read caches, and queries `prisma` directly instead of `readPrisma` until replication log lag catches up (<50ms WAL latency).
11. **Distributed Outbox Sweeper Fencing & Heartbeat Isolation:** Horizontally scaled `order-service` pods elect an active outbox sweeper via `DistributedLeaderElector` over `@repo/redis` using decoupled asynchronous heartbeat renewal loops with monotonically increasing fencing tokens (`fencingToken`) to prevent heartbeat drift and duplicate Kafka dispatches.

## Before changing anything

1. Read the workspace `AGENTS.md` for the code you are editing.
2. Check `docs/DEPENDENCIES.md` if your change touches package boundaries or public APIs.
3. If you touch an event, update producers, consumers, `@repo/types`, and
   `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.
