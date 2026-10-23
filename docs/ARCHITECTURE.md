# Architecture

Larekmart is a microservices e-commerce platform. This document describes the system
shape, component responsibilities, data ownership, and the flows that connect them.
For event payloads see [`EVENT-DRIVEN-ARCHITECTURE.md`](./EVENT-DRIVEN-ARCHITECTURE.md);
for the package graph see [`DEPENDENCIES.md`](./DEPENDENCIES.md);
for API endpoints see [`API.md`](./API.md);
for security policies see [`SECURITY.md`](./SECURITY.md);
for business & product requirements see [`BRD.md`](./BRD.md), [`PRD.md`](./PRD.md), [`FRD.md`](./FRD.md), [`TRD.md`](./TRD.md), [`MRD.md`](./MRD.md), [`DATA-STRATEGY.md`](./DATA-STRATEGY.md), and [`AI-EVALUATION-FRAMEWORK.md`](./AI-EVALUATION-FRAMEWORK.md).

## Principles

1. **Frontends own interaction; services own logic and data.** The Next.js apps contain
   no business rules beyond presentation and validation.
2. **Database-per-service.** `product-service` owns PostgreSQL; `order-service` owns
   MongoDB. No service reads another's database.
3. **Asynchronous integration.** Services publish and consume Kafka events; they never
   call each other over HTTP. Consistency between services is eventual.
4. **Contracts are shared, not duplicated.** Cross-boundary types and schemas live in
   `@repo/types`.
5. **Auth is centralized on Clerk.** Every entry point verifies a Clerk session; role
   checks read session claims.

## Components

### Frontends

**`client` (storefront, :3002)** — Next.js 16 App Router, React 19.

- Browsing: `ProductList`, `Categories`, `Filter`, `SearchBar`, OpenSearch autocomplete.
- Animation & Overlays: Framer Motion physics-based drawers & modals (`CartDrawer`, `WishlistDrawer`, `QuickViewModal`, checkout transitions in `cart/page.tsx`); GSAP `HeroBanner` promotional timeline carousels; GPU-accelerated Tailwind transitions for static SSR listing grids.
- Hydration Safety: LocalStorage client store guards (`isMounted`) and `suppressHydrationWarning` for live countdown timers and SVG extension injections.
- Product page: variant (size/color) selection via search params; `ProductInteraction`
  writes to the cart; interaction telemetry (`VIEW`, `ADD_TO_CART`).
- Cart: `zustand` store persisted to `localStorage` (`src/stores/cartStore.ts`) with optimistic sync to `cart-service`.
- Checkout: `ShippingForm` (carrier rate calculations & COD) → `StripePaymentForm` (Stripe `CheckoutProvider`, custom UI) / `CodConfirmationForm` →
  return page polls the session status → `/orders`.
- Customer Returns Hub: `/account/returns` real-time return tracking, status badges, RMA details, carrier tracking links, and printable return label slips. Returns can be initiated directly from `/orders` via `RequestReturnModal`.
- Merchant Storefronts & Onboarding: `/become-a-seller` merchant onboarding flow with KYB organization details, `/stores/[slug]` dedicated seller storefront profile and catalog showcase, and `SellerBadge` trust tags on marketplace product cards.
- Auth: Clerk; server components fetch orders with `auth().getToken()`.

**`admin` (dashboard, :3003)** — Next.js App Router, shadcn/ui, Tailwind v4.

- Sections: dashboard (charts, cards, todo), products, categories, users, orders, promotions, reviews, wishlists, returns (`/returns` returns management dashboard with KPI cards, inspection modal, approval/rejection dialogs, refund status tracking, and refund retry), vendors (`/vendors` legal business entity and KYB verification approval dashboard), sellers (`/sellers` marketplace seller account and commission oversight), and cache
  performance (Redis hit/miss rates per service, scraped live from each service's `/metrics`).
- Data tables: TanStack Table with column defs per section.
- Mutations: TanStack Query `useMutation` with a Clerk token; forms use
  react-hook-form + Zod schemas from `@repo/types`.
- Product images upload through media-service's presigned direct-to-storage flow
  (`src/services/media.service.ts`); products reference them by `mediaId`, and the
  `MediaImage` component resolves references to URLs dynamically (legacy URL values
  pass through untouched during migration).
- Access control: `src/middleware.ts` requires `metadata.role === "admin"`.

### Gateway

**`api-gateway` (Fastify 5, :8080 / :8090)** — Single public entry point reverse proxy.

- **Responsibilities**: Request routing, authentication enforcement (Clerk session validation),
  authorization context injection (`x-user-id`, `x-user-role`, `x-internal-secret`), rate limiting
  via Redis token bucket, request correlation (`x-request-id`, `x-correlation-id`), W3C traceparent
  propagation, circuit breaking, safe retries (GET/HEAD), and bounded timeouts.
- **Routing**: Centralized declarative route registry mapping all 18 downstream microservices.
- **Aggregation**: `GET /api/v1/home` fans out concurrently to `catalog-service` and
  `recommendation-service` with graceful partial degradation.
- **Security**: Strips client-supplied internal headers before routing; enforces role gates
  (public, authenticated, admin).

### Services

**`product-service` (Express 5, :8000)** — the catalog.

- Routes: `/products` (GET list, GET one, GET `/search` OpenSearch-backed, POST create,
  PUT/DELETE admin, POST `/backfill-search` admin), `/categories` (GET public, mutations
  admin), `/health`, `/test`.
- Persistence: Prisma → PostgreSQL (`Product`, `Category`).
- Publishes `product.created` and `product.deleted` for Stripe sync.
- Reads the shared OpenSearch product index through `@repo/opensearch` for `GET /products/search`;
  index writes stay owned by search-service.
- Caching: Redis (`product:v1:*` namespace) through `@repo/redis` — read-through cache for
  `GET /products`, `GET /products/:id`, and `GET /categories`, invalidated by a namespace-version
  bump on every product/category mutation.

**`order-service` (Fastify 5, :8001)** — orders and analytics.

- Routes: `/user-orders` (user-scoped), `/orders` (admin, optional `limit`),
  `/order-chart` (admin, 6-month aggregation), `/health`, `/test`.
- Persistence: Mongoose → MongoDB (`Order`, statuses `success | failed`).
- Caching: Redis (`order:v1:*` namespace) through `@repo/redis` — read-through cache for
  `GET /order-chart`, TTL-bounded rather than invalidated on write, because orders arrive faster
  than a per-order invalidation could be repopulated.
- Consumes `payment.successful` → `createOrder` → publishes `order.created`.

**`payment-service` (Hono, :8002)** — money.

- Routes: `/sessions/create-checkout-session`, `/sessions/:id`, `/webhooks/stripe`,
  `/health`.
- Stripe custom checkout (`ui_mode: "custom"`); prices fetched live from Stripe.
- Consumes `product.created` / `product.deleted` → creates/deletes Stripe products.
- Emits `payment.successful` from the verified webhook.

**`auth-service` (Express 5, :8003)** — user administration.

- Routes: `/users` (list, get, create, delete) — **entirely admin-gated**.
- Wraps the Clerk backend SDK; emits `user.created`.

**`email-service`** — a worker with no HTTP surface.

- Consumes `user.created` and `order.created`; sends mail via nodemailer (Gmail OAuth2).

**`analytic-service` (Express 5, :8004)** — metrics and event analytics.

- Routes: `/analytics/summary`, `/analytics/daily-chart`, `/analytics/events`, `/health`.
- Consumes `payment.successful`, `order.created`, `user.created`, `product.created`, and `product.deleted`.
- Tracks real-time KPI metrics and persists event audit logs and daily summaries to PostgreSQL.
- Caching: Redis (`analytics:v1:*` namespace) through `@repo/redis` — TTL-bounded read-through cache for
  `/analytics/daily-chart` and `/analytics/events`. Entries expire rather than being invalidated per event,
  because events arrive faster than a write-through invalidation would repopulate them.

**`notification-service` (Go 1.22 / Chi, :8005)** — unified notification orchestration.

- Routes: `/health`, `/ready`, `/metrics`, `/ws`, `/notifications`, `/notifications/unread`, `/notifications/:id/read`, `/notifications/read-all`, `/notifications/devices`, `/notifications/preferences`, `/notifications/templates`.
- Channels: Email (delegated via Kafka/email-service), SMS (provider abstraction), Push (device registry), In-App (PostgreSQL + WebSocket hub).
- Consumes: `user.created`, `order.created`, `payment.successful`, `notification.dispatch`.
- Persistence & State: PostgreSQL (`notifications`, `notification_deliveries`, `notification_preferences`, `notification_templates`, `user_devices`, `notification_events`) + Redis fast deduplication.

**`search-service` (Fastify 5, :8006)** — product search and indexing.

- Routes: `GET /api/v1/search` (full-text + faceted), `GET /api/v1/suggestions` (autocomplete), `POST /api/v1/indexing/product` (upsert), `DELETE /api/v1/indexing/product/:id`, `POST /api/v1/indexing/bulk`, `POST /api/v1/indexing/reindex`, `/health`, `/ready`, `/metrics`.
- Persistence: OpenSearch (`products-v1` index, `products` alias) — owns the denormalized search document.
- Caching: Redis (`search:v1:*` namespace) for search result and suggestion responses.
- Consumes: `product.created`, `product.updated`, `product.deleted` → keeps the search index in sync with product-service.
- Depends on: `@repo/opensearch` (client, mappings, query builders, search execution, bulk + single-document indexing, reindexing).

**`inventory-service` (Hono 4, :8007)** — stock and reservation authority.

- Routes: `/api/v1/inventory` for availability, reservations, confirmation, release, expiry, restock, adjustments, low-stock queries, and movement history; plus `/health`, `/ready`, and `/metrics`.
- Persistence: PostgreSQL through `@repo/inventory-db`; available, reserved, and sold quantities remain authoritative there.
- Caching: Redis (`inventory:v1:*`) only for best-effort availability reads.
- Events: publishes `inventory.*` events after committed transactions; Kafka is never used to decide stock availability.

**`recommendation-service` (Python 3.12+ / FastAPI, :8008)** — personalization and recommendation platform.

- Routes: `GET /api/v1/recommendations/home`, `GET /api/v1/recommendations/personalized`, `GET /api/v1/recommendations/trending`, `GET /api/v1/recommendations/popular`, `GET /api/v1/recommendations/similar/:id`, `GET /api/v1/recommendations/frequently-bought-together/:id`, `POST /api/v1/interactions`, `POST /api/v1/analytics/events`, `/health`, `/health/live`, `/health/ready`, `/metrics`.
- Strategies: Hybrid candidate generation and ranking combining Collaborative Filtering, Content-Based, Vector Similarity (`pgvector` 128-dim cosine distance), Trending velocity with half-life decay, and Popularity fallbacks.
- Persistence: PostgreSQL + `pgvector` (`user_interactions`, `product_embeddings`, `user_embeddings`, `recommendation_models`, `recommendation_jobs`, `processed_events`, `recommendation_analytics_events`).
- Caching: Redis (`recommendations:*`) read-through cache with TTL and user/product invalidation.
- Asynchronous Workers: Celery with Redis broker for offline candidate calculation, embedding indexing, model training metadata registration, and retention data pruning.
- Consumes: `product.created`, `product.updated`, `payment.successful`, `order.created`, `product.viewed`, `recommendation.interaction`.

**`cart-service` (Express 5, :8009)** — persistent and guest cart authority, pricing estimates, and merge engine.

- Routes: `GET /api/v1/cart`, `POST /api/v1/cart/items`, `PATCH /api/v1/cart/items/:id`, `DELETE /api/v1/cart/items/:id`, `POST /api/v1/cart/merge`, `DELETE /api/v1/cart`, `POST /api/v1/cart/coupons`, `DELETE /api/v1/cart/coupons/:code`, `POST /api/v1/cart/refresh-pricing`, `GET /api/v1/cart/summary`, `/health`, `/health/live`, `/health/ready`, `/metrics`.
- Persistence: MongoDB via `@repo/cart-db` (Mongoose 8); carts, items, coupons, adjustments, snapshots, and processed events are authoritative here.
- Caching: Redis (`cart:v1:*`) active cart cache and sorted-set expiration tracking (`cart:v1:expirations`).
- Merge Engine: Transactional guest-to-user cart merge upon customer authentication with capacity capping and adjustment audit logs.
- Pricing: Cart-level estimated totals and versioned snapshots (decoupled from final order pricing).
- Background Workers: Sorted-set expiration reaper running every 60s for deterministic TTL cleanup.
- Events: Publishes `cart.*` events (`cart.created`, `cart.item_added`, `cart.item_updated`, `cart.item_removed`, `cart.merged`, `cart.coupon_added`, `cart.coupon_removed`, `cart.expired`, `cart.cleared`). Consumes `product.updated`, `product.deleted`, and `inventory.adjusted`.

**`catalog-service` (Fastify 5, :8010)** — read-optimized product discovery, storefront browsing, categories, collections, and merchandising.

- Routes: `GET /api/v1/catalog/products`, `GET /api/v1/catalog/products/:slugOrId`, `GET /api/v1/catalog/categories`, `GET /api/v1/catalog/collections`, `GET /api/v1/catalog/brands`, `GET /api/v1/catalog/featured`, `POST /api/v1/catalog/sync`, `/health`, `/health/live`, `/health/ready`, `/metrics`.
- Persistence: PostgreSQL via `@repo/catalog-db` (Prisma) targeting `larekmart_catalog_db`.
- Caching: Redis (`catalog:v1:*` namespace) for high-speed catalog listing and navigation cache.
- Event Synchronization: Consumes `product.created`, `product.updated`, `product.deleted` from Kafka to maintain materialized read-models without coupling storefront browsing to writes.

**`shipping-service` (Koa / Node.js, :8011)** — shipment lifecycle, package management, rates, and multi-carrier adapter orchestration.

- Routes: `GET /api/v1/shipping/methods`, `GET /api/v1/shipping/rates`, `POST /api/v1/shipments`, `GET /api/v1/shipments/:id`, `GET /api/v1/shipments/:id/tracking`, `POST /api/v1/shipments/:id/label`, `POST /api/v1/shipments/:id/cancel`, `POST /api/v1/webhooks/carriers/:carrier`, `/api/v1/health`, `/api/v1/health/live`, `/api/v1/health/ready`.
- Carrier Adapter Layer: Pluggable `ShippingProvider` interface abstracting TCS, Leopards, DHL, FedEx, and Custom carrier integrations.
- Persistence: PostgreSQL via `@repo/shipping-db` (Prisma) targeting `larekmart_shipping_db` (`shipments`, `shipment_items`, `shipment_packages`, `shipping_methods`, `tracking_events`, `shipping_labels`, `delivery_attempts`, `carrier_accounts`, `shipping_webhooks`, `processed_events`).
- Address Snapshot: Stores immutable shipping snapshot (`full_name`, `phone`, `address_line1`, `city`, `postal_code`, `country`) rather than depending on mutable customer profiles.
- Caching: Redis (`shipping:v1:*` namespace) for rate calculation cache, tracking event cache, and carrier webhook idempotency deduplication.
- Events: Publishes `shipment.created`, `shipment.label_created`, `shipment.shipped`, `shipment.in_transit`, `shipment.out_for_delivery`, `shipment.delivered`, `shipment.cancelled`, `shipment.failed`, `tracking.updated`. Consumes `order.created`, `order.cancelled`, `payment.successful`.

**`user-service` (Fastify 5, :8012)** — customer profiles, saved addresses, preferences, and account settings domain authority.

- Routes: `GET /api/v1/users/me`, `PATCH /api/v1/users/me`, `DELETE /api/v1/users/me`, `GET /api/v1/users/me/profile`, `PATCH /api/v1/users/me/profile`, `GET /api/v1/users/me/addresses`, `POST /api/v1/users/me/addresses`, `GET /api/v1/users/me/addresses/:addressId`, `PATCH /api/v1/users/me/addresses/:addressId`, `DELETE /api/v1/users/me/addresses/:addressId`, `GET /api/v1/users/me/preferences`, `PATCH /api/v1/users/me/preferences`, `GET /api/v1/users/me/settings`, `PATCH /api/v1/users/me/settings`, `GET /api/v1/users/admin/users`, `GET /api/v1/users/admin/users/:id`, `PATCH /api/v1/users/admin/users/:id/status`, `/health`, `/ready`, `/metrics`.
- Persistence: PostgreSQL via `@repo/user-db` (Prisma) targeting `user_db` (`users`, `user_profiles`, `user_addresses`, `user_preferences`, `user_settings`, `processed_events`). Keeps authentication credentials and passwords completely out of the database (strictly delegated to Clerk / `auth-service`).
- Caching: Redis (`user:v1:*` namespace) through `@repo/redis` — read-through cache for user profile, address lists, preferences, and settings with controlled short TTLs (300s) and write invalidation.
- Address Management: Manages customer default shipping & billing addresses, ensuring transactional single-default guarantees. Downstream checkout/shipping services snapshot addresses immutably to preserve historical records.
- Events: Publishes `user.created`, `user.updated`, `user.profile_updated`, `user.address_created`, `user.address_updated`, `user.address_deleted`, `user.preferences_updated`, `user.deleted`, `user.deletion_requested`. Consumes `user.created`, `auth.user_created`, `user.registered` with idempotency deduplication via `processed_events`.

**`media-service` (Hono, :8013)** — object storage, media metadata, upload lifecycle, and image variants.

- Routes: `POST /api/v1/media/uploads` (validate + presigned PUT URL), `POST /api/v1/media/:mediaId/complete` (verify object + enqueue processing), `GET /api/v1/media/:mediaId`, `GET /api/v1/media/:mediaId/url`, `GET /api/v1/media/owner/:ownerType/:ownerId`, `DELETE /api/v1/media/:mediaId` (soft), admin list/reprocess/restore/purge, `/health`, `/health/live`, `/health/ready`, `/metrics`.
- Persistence: PostgreSQL via Drizzle ORM targeting `media_db` (`media`, `media_variants`, `media_uploads`, `media_processing_jobs`, `processed_events`). Binaries never live in the database.
- Storage: S3-compatible object storage behind the `ObjectStorage` interface — MinIO in development (`minio` + `minio-init` compose services), any S3-compatible provider in production. Uploads are presigned and direct-to-storage; binaries never traverse the API. URLs are generated dynamically from `bucket` + `object_key`, never persisted.
- Processing: `media-worker` claims jobs from `media_processing_jobs` (`FOR UPDATE SKIP LOCKED`) and runs Sharp (thumbnail/small/medium/large WebP variants) independently of the API; `media-cleanup` requeues stale `PROCESSING` jobs (crashed-worker recovery, `MEDIA_WORKER_STALE_JOB_SECONDS`, default 900s), expires abandoned upload sessions, and purges soft-deleted media past the retention window.
- Ownership: generic `(ownerType, ownerId)` references with no cross-database foreign keys; mutations are gated by the Clerk `createdBy` identity; PRIVATE media resolves through presigned URLs only.
- Events: publishes `media.upload_requested`, `media.uploaded`, `media.processing_started`, `media.processing_completed`, `media.processing_failed`, `media.deleted`, `media.quarantined`. Consumes `product.deleted`, `seller.deleted`, `review.deleted`, `user.deleted`, `category.deleted`, `brand.deleted` (idempotently via `processed_events`) to soft-delete associated media.

**`review-service` (Fastify 5, :8014)** — product reviews, ratings, verified purchases, moderation, and helpful votes.

- Routes: `GET /api/v1/products/:productId/reviews`, `GET /api/v1/products/:productId/rating-summary`, `GET /api/v1/reviews/:reviewId`, `POST /api/v1/products/:productId/reviews`, `GET /api/v1/me/reviews`, `PATCH /api/v1/reviews/:reviewId`, `DELETE /api/v1/reviews/:reviewId`, `POST /api/v1/reviews/:reviewId/votes`, `POST /api/v1/reviews/:reviewId/reports`, `POST /api/v1/reviews/:reviewId/response`, admin moderation & reports (`/api/v1/admin/reviews/*`), `/health`, `/ready`.
- Persistence: PostgreSQL via Drizzle ORM targeting `review_db` (`reviews`, `review_media`, `review_votes`, `review_reports`, `review_moderation_actions`, `seller_responses`, `product_rating_summaries`, `purchase_eligibility`).
- Caching: Redis (`review:*` namespace) through `@repo/redis` for product rating summary caching, fast cache invalidation, and rate limiting.
- Verified Purchases: Strictly enforces verified purchase status derived from consumed `order.delivered` and `shipment.delivered` Kafka events.
- Events: Publishes `review.created`, `review.updated`, `review.deleted`, `review.approved`, `review.rejected`, `review.reported`, `product.rating-summary.updated`. Consumes `order.delivered`, `order.completed`, `shipment.delivered`, `product.deleted`, `user.deleted`.

**`wishlist-service` (Fastify 5, :8015)** — saved products, multiple wishlists, guest-to-user merging, price drop & restock alerts.

- Routes: `GET /api/v1/me/wishlists`, `POST /api/v1/me/wishlists`, `GET /api/v1/me/wishlists/:wishlistId`, `PATCH /api/v1/me/wishlists/:wishlistId`, `DELETE /api/v1/me/wishlists/:wishlistId`, `POST /api/v1/me/wishlists/:wishlistId/items`, `DELETE /api/v1/me/wishlists/:wishlistId/items/:itemId`, `DELETE /api/v1/me/wishlists/:wishlistId/items` (bulk), `POST /api/v1/me/wishlists/:wishlistId/items/move`, `POST /api/v1/me/wishlists/merge`, `POST /api/v1/me/wishlists/:wishlistId/share`, `GET /api/v1/shared-wishlists/:shareToken`, `GET /api/v1/admin/wishlists/overview`, `GET /api/v1/admin/wishlists`, `/health`, `/ready`, `/metrics`.
- Persistence: PostgreSQL via Drizzle ORM targeting `larekmart_wishlist_db` (`wishlists`, `wishlist_items`, `wishlist_shares`, `wishlist_events`).
- Caching: Redis (`wishlist:v1:*` namespace) through `@repo/redis` for unguessable share token caching, TTL verification, and rate limiting.
- Deduplication & Merging: Unique index on `(wishlist_id, product_id, COALESCE(variant_id, ''))` strictly prevents duplicates. Guest wishlists are migrated idempotently to customer default wishlist upon authentication.
- Events: Publishes `wishlist.created`, `wishlist.item.added`, `wishlist.item.removed`, `wishlist.item.moved`, `wishlist.merged`, `wishlist.price-drop`, `wishlist.restocked`. Consumes `product.updated`, `product.deleted`, `price.updated`, `inventory.availability.changed`, `inventory.adjusted`, `user.deleted`.

**`promotion-service` (Hono 4, :8016)** — centralized promotion engine for campaigns, coupons, discount calculations, budgets, and checkout reservations.

- Routes: `GET /api/v1/promotions/active`, `POST /api/v1/promotions/quote`, `POST /api/v1/promotions/validate-coupon`, `POST /api/v1/promotions/reserve`, `POST /api/v1/promotions/commit`, `POST /api/v1/promotions/release`, `GET /api/v1/admin/promotions`, `POST /api/v1/admin/promotions`, `GET /api/v1/admin/promotions/:id`, `PATCH /api/v1/admin/promotions/:id`, `POST /api/v1/admin/promotions/:id/deactivate`, `POST /api/v1/admin/promotions/:id/coupons`, `GET /api/v1/admin/promotions/:id/redemptions`, `GET /api/v1/admin/promotions/overview`, `/health`, `/health/live`, `/health/ready`, `/metrics`.
- Persistence: PostgreSQL via Drizzle ORM targeting `larekmart_promotion_db` (`promotions`, `promotion_rules`, `promotion_targets`, `coupon_codes`, `promotion_reservations`, `promotion_redemptions`, `promotion_budgets`, `promotion_audit_logs`).
- Caching: Redis (`promotion:v1:*` namespace) through `@repo/redis` for cached active campaigns, coupon lookups, and rate limiting.
- Reservation Lifecycle: 15-minute transactional hold on promotional budgets and customer usage counts during checkout (`PENDING`), committed (`COMMITTED`) on order confirmation, and released (`RELEASED` / `EXPIRED`) on checkout failure or background worker sweep.
- Events: Publishes `promotion.created`, `promotion.activated`, `promotion.deactivated`, `promotion.budget_exhausted`, `promotion.reserved`, `promotion.redeemed`, `promotion.released`. Consumes `order.created`, `order.confirmed`, `order.completed`, `order.cancelled`.

**`tax-service` (Fastify 5, :8017)** — jurisdiction-aware tax calculation, configurable versioned tax rules, customer exemptions, auditable quotes, historical calculation snapshots, and replaceable external provider adapter pattern.

- Routes: `POST /api/v1/tax/quote`, `POST /api/v1/tax/calculate`, `GET /api/v1/tax/calculations/:calculationId`, `POST /api/v1/tax/returns/quote`, `GET /api/v1/tax/jurisdictions`, `GET /api/v1/tax/categories`, `POST /api/v1/admin/tax/rules`, `PATCH /api/v1/admin/tax/rules/:ruleId`, `POST /api/v1/admin/tax/rules/:ruleId/activate`, `POST /api/v1/admin/tax/jurisdictions`, `POST /api/v1/admin/tax/categories`, `POST /api/v1/admin/tax/exemptions`, `/health`, `/ready`.
- Persistence: MySQL via Drizzle ORM targeting `tax_db` (`tax_jurisdictions`, `tax_categories`, `tax_rules`, `tax_exemptions`, `tax_calculations`, `tax_calculation_lines`, `tax_provider_logs`).
- Caching: Redis (`tax:v1:*` namespace) through `@repo/redis` for rule caching and rate limiting.
- Arithmetic Precision: Decimal-safe financial arithmetic (`decimal.js` with `ROUND_HALF_UP`) ensuring zero floating point inaccuracy across inclusive and exclusive calculations.
- Events: Publishes `tax.calculation.completed`, `tax.calculation.failed`, `tax.rules.updated`, `tax.calculation.adjusted`. Consumes `order.created`, `product.tax-category.updated`, `tax.rules.updated`.

**`return-service` (Koa 2, :8018)** — multi-seller return & refund lifecycle orchestration: customer return requests, partial-quantity returns, eligibility verification, evidence media, warehouse inspections, return shipments, refund SAGA coordination, and transactional outbox.

- Routes: `POST /api/v1/returns/orders/:orderId`, `GET /api/v1/returns`, `GET /api/v1/returns/:returnId`, `DELETE /api/v1/returns/:returnId`, `POST /api/v1/returns/:returnId/evidence`, `POST /api/v1/returns/:returnId/tracking`, `GET /api/v1/admin/returns`, `GET /api/v1/admin/returns/:returnId`, `POST /api/v1/admin/returns/:returnId/approve`, `POST /api/v1/admin/returns/:returnId/reject`, `POST /api/v1/admin/returns/:returnId/inspect`, `POST /api/v1/admin/returns/:returnId/refund/retry`, `/health`, `/ready`, `/metrics`.
- Persistence: MySQL via Drizzle ORM targeting `return_db` (`returns`, `return_items`, `return_media`, `return_shipments`, `return_inspections`, `return_refunds`, `return_state_transitions`, `return_policy_versions`, `return_reasons`, `return_outbox`).
- Caching: Redis (`return:v1:*` namespace) through `@repo/redis` for policy cache, eligibility verification TTLs, and rate limiting.
- Arithmetic Precision: Decimal-safe financial arithmetic (`decimal.js` with `ROUND_HALF_UP`) ensuring zero floating-point inaccuracy across partial quantity refunds, prorated item discounts, and sales tax refunds.
- Events: Publishes `return.requested`, `return.approved`, `return.rejected`, `return.cancelled`, `return.shipment.requested`, `return.inspection.completed`, `return.refund.requested`, `return.completed`. Consumes `order.delivered`, `payment.refund.succeeded`, `payment.refund.failed`, `shipping.label.created`.

**`pricing-service` (Fastify 5, :8019)** — authoritative merchandise pricing, multi-currency conversion, tiered volume rules, promotional discount composition, immutable quote snapshots, and audit history.

- Routes: `POST /api/v1/prices/calculate`, `POST /api/v1/prices/quote`, `GET /api/v1/prices/quotes/:quoteId`, `GET /api/v1/prices/products/:productId`, `GET /api/v1/prices/rates`, `POST /api/v1/admin/price-lists`, `GET /api/v1/admin/price-lists`, `POST /api/v1/admin/prices`, `POST /api/v1/admin/prices/rules`, `POST /api/v1/admin/prices/rates`, `GET /api/v1/admin/prices/history/:productId`, `/health`, `/ready`, `/metrics`.
- Persistence: PostgreSQL via Drizzle ORM targeting `pricing_db` (`price_lists`, `product_prices`, `variant_prices`, `price_rules`, `price_history`, `price_quotes`, `currency_rates`).
- Caching: Redis (`pricing:v1:*` namespace) through `@repo/redis` for active exchange rates, cached quotes, and rate limiting.
- Arithmetic Precision: Decimal-safe financial arithmetic (`decimal.js` with `ROUND_HALF_UP` and 20-digit precision) ensuring zero floating-point drift across multi-currency conversions and tiered volume computations.
- Negative Price Guard: Strict zero-floor clamping ensuring discounts and promotions never produce negative totals.
- Events: Publishes `pricing.price.created`, `pricing.price.updated`, `pricing.price.expired`, `pricing.quote.created`. Consumes `product.created`, `product.deleted`, `order.created`.

**`vendor-service` (NestJS 10 / Fastify, :8020)** — legal business entities, merchant onboarding, KYB verification, documents, and lifecycle state management.

- Routes: `POST /api/v1/vendors`, `GET /api/v1/vendors`, `GET /api/v1/vendors/:id`, `PATCH /api/v1/vendors/:id`, `GET /api/v1/vendors/:id/business-profile`, `PUT /api/v1/vendors/:id/business-profile`, `POST /api/v1/vendors/:id/documents`, `GET /api/v1/vendors/:id/documents`, `POST /api/v1/vendors/:id/verifications`, `GET /api/v1/vendors/:id/verifications`, `POST /api/v1/vendors/:id/members`, `GET /api/v1/vendors/:id/members`, `POST /api/v1/admin/vendors/:id/approve`, `POST /api/v1/admin/vendors/:id/reject`, `POST /api/v1/admin/vendors/:id/suspend`, `POST /api/v1/admin/vendors/:id/reactivate`, `/health`, `/health/live`, `/health/ready`, `/metrics`.
- Persistence: PostgreSQL via `@repo/vendor-db` (Prisma) targeting `larekmart_vendor_db` (`vendors`, `vendor_business_profiles`, `vendor_documents`, `vendor_verifications`, `vendor_members`, `vendor_status_history`).
- Caching: Redis (`vendor:v1:*` namespace) through `@repo/redis` for vendor entity lookups, verification status cache, and rate limiting.
- KYB & Media: Coordinates business verification documents using media-service presigned uploads and Clerk identity context.
- Events: Publishes `vendor.created`, `vendor.updated`, `vendor.verified`, `vendor.rejected`, `vendor.suspended`, `vendor.reactivated`, `vendor.document_uploaded`, `vendor.verification_submitted`. Consumes `media.uploaded`, `user.deleted`.

**`seller-service` (Fastify 5, :8021)** — marketplace storefront configuration, staff & permissions, operational settings, performance snapshots, and seller lifecycle.

- Routes: `POST /api/v1/sellers`, `GET /api/v1/sellers`, `GET /api/v1/sellers/me`, `GET /api/v1/sellers/:id`, `PATCH /api/v1/sellers/:id`, `GET /api/v1/storefronts/:slug`, `GET /api/v1/sellers/:id/storefront`, `PATCH /api/v1/sellers/:id/storefront`, `GET /api/v1/sellers/:id/settings`, `PATCH /api/v1/sellers/:id/settings`, `POST /api/v1/sellers/:id/staff`, `GET /api/v1/sellers/:id/staff`, `PUT /api/v1/sellers/:id/policies`, `GET /api/v1/sellers/:id/performance`, `GET /api/v1/admin/sellers`, `POST /api/v1/admin/sellers/:id/status`, `POST /api/v1/admin/sellers/:id/activate`, `POST /api/v1/admin/sellers/:id/suspend`, `GET /api/v1/system-settings` (public discovery), `GET /api/v1/admin/system-settings` (admin read), `PATCH /api/v1/admin/system-settings` (Super Admin toggle), `/health`, `/ready`, `/metrics`.
- Persistence: PostgreSQL via Drizzle ORM targeting `larekmart_seller_db` (`sellers`, `seller_stores`, `seller_staff`, `seller_settings`, `seller_policies`, `seller_status_history`, `seller_performance_snapshots`, `system_settings`).
- Caching: Redis (`seller:v1:*` namespace) through `@repo/redis` for storefront public profiles, staff permission lookups, and rate limiting.
- Marketplace Multi-Tenancy: Bridges verified legal vendors with one or more customer-facing storefronts, enforcing role-based permissions (owner, manager, staff).
- Events: Publishes `seller.created`, `seller.updated`, `seller.suspended`, `seller.reactivated`, `seller.staff_added`, `seller.staff_removed`, `seller.metrics_updated`. Consumes `vendor.verified`, `vendor.suspended`, `order.created`, `order.delivered`, `review.created`.

## Data ownership

| Store      | Owner                            | Accessed via                  | Notable models                                                                                                                                               |
| ---------- | -------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PostgreSQL | product-service                  | `@repo/product-db` (Prisma)   | `Product`, `Category`                                                                                                                                        |
| PostgreSQL | inventory-service                | `@repo/inventory-db` (Prisma) | `inventory_items`, `inventory_reservations`, `inventory_movements`                                                                                           |
| PostgreSQL | catalog-service                  | `@repo/catalog-db` (Prisma)   | `catalog_products`, `catalog_categories`, `catalog_brands`, `catalog_collections`                                                                            |
| PostgreSQL | shipping-service                 | `@repo/shipping-db` (Prisma)  | `shipments`, `shipment_items`, `shipment_packages`, `shipping_methods`, `tracking_events`, `shipping_labels`                                                 |
| PostgreSQL | user-service                     | `@repo/user-db` (Prisma)      | `users`, `user_profiles`, `user_addresses`, `user_preferences`, `user_settings`, `processed_events`                                                          |
| PostgreSQL | recommendation-service           | SQLAlchemy async (`asyncpg`)  | `user_interactions`, `product_embeddings`, `user_embeddings`, `recommendation_models`, `processed_events`, `recommendation_analytics`                        |
| PostgreSQL | analytic-service                 | `pg.Pool`                     | `analytics_events`, `analytics_daily_summary`                                                                                                                |
| PostgreSQL | notification-service             | `pgxpool.Pool` (Go)           | `notifications`, `notification_deliveries`, `notification_preferences`, `notification_templates`, `user_devices`, `notification_events`                      |
| PostgreSQL | media-service                    | Drizzle (`pg`)                | `media`, `media_variants`, `media_uploads`, `media_processing_jobs`, `processed_events`                                                                      |
| PostgreSQL | review-service                   | Drizzle (`pg`)                | `reviews`, `review_media`, `review_votes`, `review_reports`, `review_moderation_actions`, `seller_responses`, `product_rating_summaries`                     |
| PostgreSQL | wishlist-service                 | Drizzle (`pg`)                | `wishlists`, `wishlist_items`, `wishlist_shares`, `wishlist_events`                                                                                          |
| PostgreSQL | promotion-service                | Drizzle (`pg`)                | `promotions`, `promotion_rules`, `promotion_targets`, `coupon_codes`, `promotion_reservations`, `promotion_redemptions`, `promotion_budgets`                 |
| PostgreSQL | pricing-service                  | Drizzle (`pg`)                | `price_lists`, `product_prices`, `variant_prices`, `price_rules`, `price_history`, `price_quotes`, `currency_rates`                                          |
| PostgreSQL | vendor-service                   | `@repo/vendor-db` (Prisma)    | `vendors`, `vendor_business_profiles`, `vendor_documents`, `vendor_verifications`, `vendor_members`, `vendor_status_history`                                 |
| PostgreSQL | seller-service                   | Drizzle (`pg`)                | `sellers`, `seller_stores`, `seller_staff`, `seller_settings`, `seller_policies`, `seller_status_history`, `seller_performance_snapshots`, `system_settings` |
| MySQL      | tax-service                      | Drizzle (`mysql2`)            | `tax_jurisdictions`, `tax_categories`, `tax_rules`, `tax_exemptions`, `tax_calculations`, `tax_calculation_lines`, `tax_provider_logs`                       |
| MySQL      | return-service                   | Drizzle (`mysql2`)            | `returns`, `return_items`, `return_media`, `return_shipments`, `return_inspections`, `return_refunds`, `return_state_transitions`, `return_outbox`           |
| S3/MinIO   | media-service                    | `ObjectStorage` (AWS SDK S3)  | `media` bucket: originals + generated variants (`{owners}/{ownerId}/{mediaId}/…` keys)                                                                       |
| Redis      | notification-service             | `go-redis` (Go)               | `event:<id>` (idempotency fast-cache)                                                                                                                        |
| Redis      | search-service                   | `@repo/redis` (ioredis)       | `search:v1:*` (search result cache, suggestion cache, rate-limit buckets)                                                                                    |
| Redis      | product-service                  | `@repo/redis` (ioredis)       | `product:v1:*` (catalog read-through cache)                                                                                                                  |
| Redis      | catalog-service                  | `@repo/redis` (ioredis)       | `catalog:v1:*` (storefront product & collection cache)                                                                                                       |
| Redis      | shipping-service                 | `@repo/redis` (ioredis)       | `shipping:v1:*` (shipping rate cache, tracking cache, webhook idempotency)                                                                                   |
| Redis      | user-service                     | `@repo/redis` (ioredis)       | `user:v1:*` (profile, address, preference, settings read-through cache)                                                                                      |
| Redis      | analytic-service                 | `@repo/redis` (ioredis)       | `analytics:v1:*` (dashboard read-through cache)                                                                                                              |
| Redis      | order-service                    | `@repo/redis` (ioredis)       | `order:v1:*` (6-month order-chart read-through cache)                                                                                                        |
| Redis      | cart-service                     | `@repo/redis` (ioredis)       | `cart:v1:*` (active cart cache, sorted-set expiration queue)                                                                                                 |
| Redis      | review-service                   | `@repo/redis` (ioredis)       | `review:*` (product rating summary cache, anti-abuse vote/report limits)                                                                                     |
| Redis      | wishlist-service                 | `@repo/redis` (ioredis)       | `wishlist:v1:*` (share token cache, link verification)                                                                                                       |
| Redis      | promotion-service                | `@repo/redis` (ioredis)       | `promotion:v1:*` (active promotion cache, coupon fast-lookup, rate-limiting)                                                                                 |
| Redis      | tax-service                      | `@repo/redis` (ioredis)       | `tax:v1:*` (rule cache, jurisdiction lookup fast-path)                                                                                                       |
| Redis      | return-service                   | `@repo/redis` (ioredis)       | `return:v1:*` (policy cache, return window cache, anti-abuse rate limits)                                                                                    |
| Redis      | pricing-service                  | `@repo/redis` (ioredis)       | `pricing:v1:*` (exchange rate cache, active quote cache, rate-limiting)                                                                                      |
| Redis      | vendor-service                   | `@repo/redis` (ioredis)       | `vendor:v1:*` (vendor profile cache, verification status cache, rate limits)                                                                                 |
| Redis      | seller-service                   | `@repo/redis` (ioredis)       | `seller:v1:*` (storefront profile cache, staff permission cache, rate limits), `marketplace:system_settings` (governance cache)                              |
| OpenSearch | search-service                   | `@repo/opensearch`            | `products-v1` index (alias `products`) — denormalized search document                                                                                        |
| MongoDB    | order-service                    | `@repo/order-db` (Mongoose)   | `Order`                                                                                                                                                      |
| MongoDB    | cart-service                     | `@repo/cart-db` (Mongoose)    | `Cart`, `ProcessedEvent`                                                                                                                                     |
| Clerk      | auth-service (and all frontends) | Clerk SDKs                    | users, session claims                                                                                                                                        |
| Stripe     | payment-service                  | `stripe` SDK                  | products, prices, sessions                                                                                                                                   |

`@repo/types` re-exports the persistence-derived types (`Product`, `Category`, `Order`, `Shipment`, `ShippingRate`)
so consumers can type against the catalog/order shapes without importing the DB clients
directly into their runtime.

## Key request flows

### Checkout → order → inventory → email

```
client            payment-service            Stripe              order-service        inventory-service       email-service
  │  POST /sessions/create-checkout-session ─▶│                   │                    │                       │
  │                                          │ create session ──▶│                    │                       │
  │  ◀── client_secret ───────────────────────│                   │                    │                       │
  │  confirm() ──────────────────────────────────────────────────▶│                    │                       │
  │                                          │  ◀ checkout.session.completed          │                       │
  │                                          │ verify signature  │                    │                       │
  │                                          │── payment.successful ─────────────────▶│                       │
  │                                          │                   │                    │ confirmReservation    │
  │                                          │                   │                    │── inventory.sold ────▶│
  │                                          │                   │ createOrder        │                       │
  │                                          │                   │── order.created ───┼──────────────────────▶│ send email
```

### Product → Stripe + Search index

```
admin ── POST /products ──▶ product-service ── write Prisma
                                 │
                                 ├── product.created ──▶ payment-service ── stripe.products.create
                                 └── product.created ──▶ search-service  ── OpenSearch index upsert
```

### Search index backfill

```
admin (Rebuild search index) ── POST /products/backfill-search ──▶ product-service
   │                                                                    │
   └── repeated with afterId while hasMore ──────────────────────────────┤
                                                                        └── product.updated ×N ──▶ search-service ──▶ OpenSearch upsert
```

Heals documents indexed before `product.created` carried the full product, which are
missing `images`, `sizes`, and `colors` — and therefore their thumbnails and color/size
facets. product-service only **replays** events; search-service still owns the index write,
so the ownership rule above holds. The same sweep is available as the
`pnpm --filter product-service backfill:search` CLI for larger catalogs.

### Storefront search → product index

```
client (SearchBar / Categories / Filter) ── /products?search=&category=&sort=
        │
        ├─ SearchBar (client) ── GET /api/v1/search/suggestions ──▶ search-service ──▶ OpenSearch
        │
        ▼
ProductList (server component) ── GET /products/search ──▶ product-service ── @repo/opensearch ──▶ OpenSearch
                              └─ fallback: GET /products ──▶ Prisma ──▶ PostgreSQL
```

### User creation → welcome email

```
admin ── POST /users ──▶ auth-service ── clerkClient.users.createUser
                              └── user.created ──▶ email-service ── sendMail
```

### Return & Refund SAGA Lifecycle

```
client (Request Return) ── POST /api/v1/returns/orders/:orderId ──▶ return-service ── MySQL (returns)
                                                                            │
                                                                            └── return.requested ──▶ email-service / notification-service
admin (Approve / Reject) ── POST /api/v1/admin/returns/:id/approve ──▶ return-service
                                                                            │
                                                                            ├── return.approved ──▶ email-service
                                                                            └── return.shipment.requested ──▶ shipping-service ──▶ return.shipment.created
warehouse (Inspect Items) ── POST /api/v1/admin/returns/:id/inspect ──▶ return-service
                                                                            │
                                                                            ├── return.inspection.completed ──▶ inventory-service ──▶ inventory.restocked
                                                                            └── return.refund.requested ──▶ payment-service (Stripe Refund)
                                                                                                                   │
                                                                                                                   ├── payment.refund.succeeded
                                                                                                                   │         │
                                                                                                                   │         ▼
                                                                                                                   │   return-service (mark COMPLETED)
                                                                                                                   │         │
                                                                                                                   │         ├── return.completed ──▶ order-service (mark REFUNDED)
                                                                                                                   │         └── return.completed ──▶ analytic-service & email-service
                                                                                                                   └── payment.refund.failed ──▶ return-service (mark REFUND_FAILED)
```

### Merchant Onboarding, KYB Verification & Seller Storefront Flow

```
client (Become a Seller) ── POST /api/v1/vendors ──▶ vendor-service ── Prisma ──▶ PostgreSQL (larekmart_vendor_db)
       │                                                    │
       ├── Presigned doc upload ──▶ media-service           └── vendor.created ──▶ notification-service & email-service
       │                                  │
       │                                  └── media.uploaded ──▶ vendor-service ──▶ vendor.verification_submitted
admin (Review & Approve KYB) ── POST /api/v1/admin/vendors/:id/approve ──▶ vendor-service
                                                                                │
                                                                                └── vendor.verified ──▶ seller-service (unlock seller creation)
seller (Create Storefront) ── POST /api/v1/sellers ──▶ seller-service ── Drizzle ──▶ PostgreSQL (larekmart_seller_db)
       │                                                   │
       │                                                   └── seller.created ──▶ analytic-service & notification-service
buyer (Browse Seller Store) ── GET /api/v1/sellers/slug/:slug ──▶ seller-service ── Redis (seller:v1:*) / DB
```

## Cross-cutting concerns

- **Auth:** Clerk everywhere. Backends guard with `shouldBeUser`/`shouldBeAdmin`;
  authorization is enforced server-side, with the admin middleware as UX defense.
- **Configuration:** environment variables per workspace; `.env.example` is the contract.
- **Observability:** structured logging, health checks, metrics, and telemetry across all workspaces powered by `@repo/monitoring`.
- **Search infrastructure:** all OpenSearch SDK usage, index mappings, query DSL builders,
  search execution, single/bulk document operations, and reindex/alias helpers live in
  `@repo/opensearch` — import from there, never add the SDK or DSL to individual services
  directly. search-service owns index **writes** (via Kafka); other services may only **read**
  the index through the same package.
- **Cache infrastructure:** all Redis access goes through `@repo/redis`. Each service declares a single
  handle with `createRedisService({ url, keyPrefix, serviceName, logger })`, which binds the connection,
  the key namespace, `ping()` for health checks, and `close()` for shutdown — services never wire the
  client themselves. Keys are namespaced per service by the handle's `keys` builder (`search:v1:`,
  `product:v1:`, `analytics:v1:`), so one shared Redis instance stays partitioned. Reads go through
  `cacheRead`, which reports `hit`, `miss`, or `error`, and `@repo/monitoring`'s `createCacheMetrics`
  counts those three outcomes separately as `cache_hits_total` / `cache_misses_total` /
  `cache_errors_total` (labelled by `cache_type`) at `/metrics` — an unreachable Redis is an `error`,
  not a miss, so an outage cannot masquerade as a 0% hit rate. The admin dashboard's **Cache
  Performance** page (`/cache`) scrapes them from every service and reports a **hit rate and an error
  rate** per service (plus a per-cache breakdown). The error rate is the share of read attempts that
  failed because Redis was unreachable — it is shown next to the hit rate rather than folded into it,
  so a service with a poor hit rate and a healthy cache is distinguishable from one that cannot reach
  Redis at all. Cards are ranked by error rate (highest first) so a failing cache is the first thing
  displayed. Redis is treated as **optional everywhere**: every read
  falls through to the source of truth on a miss, and a Redis outage reports `degraded`, never
  `unhealthy`, in `/health`.
- **CORS:** each service allow-lists the specific frontend origins it serves
  (`client` :3002, `admin` :3003).
- **Error shape:** `{ message }` JSON with correct status codes; a global error handler
  exists in the Express services.

## Known constraints

- Kafka broker addresses are hardcoded in `@repo/kafka` for local development; there is
  no configuration layer for clustered/managed Kafka yet.
- `email-service` has no health endpoint or HTTP server.
