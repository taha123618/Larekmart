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

**`client` (storefront, :3002)** — Next.js App Router, React 19.

- Browsing: `ProductList`, `Categories`, `Filter`, `SearchBar`.
- Product page: variant (size/color) selection via search params; `ProductInteraction`
  writes to the cart.
- Cart: `zustand` store persisted to `localStorage` (`src/stores/cartStore.ts`).
- Checkout: `ShippingForm` → `StripePaymentForm` (Stripe `CheckoutProvider`, custom UI) →
  return page polls the session status → `/orders`.
- Auth: Clerk; server components fetch orders with `auth().getToken()`.

**`admin` (dashboard, :3003)** — Next.js App Router, shadcn/ui, Tailwind v4.

- Sections: dashboard (charts, cards, todo), products, categories, users, orders, and cache
  performance (Redis hit/miss rates per service, scraped live from each service's `/metrics`).
- Data tables: TanStack Table with column defs per section.
- Mutations: TanStack Query `useMutation` with a Clerk token; forms use
  react-hook-form + Zod schemas from `@repo/types`.
- Image uploads go directly to Cloudinary from the browser.
- Access control: `src/middleware.ts` requires `metadata.role === "admin"`.

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

## Data ownership

| Store      | Owner                            | Accessed via                  | Notable models                                                                                                                          |
| ---------- | -------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL | product-service                  | `@repo/product-db` (Prisma)   | `Product`, `Category`                                                                                                                   |
| PostgreSQL | inventory-service                | `@repo/inventory-db` (Prisma) | `inventory_items`, `inventory_reservations`, `inventory_movements`                                                                      |
| PostgreSQL | catalog-service                  | `@repo/catalog-db` (Prisma)   | `catalog_products`, `catalog_categories`, `catalog_brands`, `catalog_collections`                                                       |
| PostgreSQL | shipping-service                 | `@repo/shipping-db` (Prisma)  | `shipments`, `shipment_items`, `shipment_packages`, `shipping_methods`, `tracking_events`, `shipping_labels`                            |
| PostgreSQL | recommendation-service           | SQLAlchemy async (`asyncpg`)  | `user_interactions`, `product_embeddings`, `user_embeddings`, `recommendation_models`, `processed_events`, `recommendation_analytics`   |
| PostgreSQL | analytic-service                 | `pg.Pool`                     | `analytics_events`, `analytics_daily_summary`                                                                                           |
| PostgreSQL | notification-service             | `pgxpool.Pool` (Go)           | `notifications`, `notification_deliveries`, `notification_preferences`, `notification_templates`, `user_devices`, `notification_events` |
| Redis      | notification-service             | `go-redis` (Go)               | `event:<id>` (idempotency fast-cache)                                                                                                   |
| Redis      | search-service                   | `@repo/redis` (ioredis)       | `search:v1:*` (search result cache, suggestion cache, rate-limit buckets)                                                               |
| Redis      | product-service                  | `@repo/redis` (ioredis)       | `product:v1:*` (catalog read-through cache)                                                                                             |
| Redis      | catalog-service                  | `@repo/redis` (ioredis)       | `catalog:v1:*` (storefront product & collection cache)                                                                                  |
| Redis      | shipping-service                 | `@repo/redis` (ioredis)       | `shipping:v1:*` (shipping rate cache, tracking cache, webhook idempotency)                                                              |
| Redis      | analytic-service                 | `@repo/redis` (ioredis)       | `analytics:v1:*` (dashboard read-through cache)                                                                                         |
| Redis      | order-service                    | `@repo/redis` (ioredis)       | `order:v1:*` (6-month order-chart read-through cache)                                                                                   |
| Redis      | cart-service                     | `@repo/redis` (ioredis)       | `cart:v1:*` (active cart cache, sorted-set expiration queue)                                                                            |
| OpenSearch | search-service                   | `@repo/opensearch`            | `products-v1` index (alias `products`) — denormalized search document                                                                   |
| MongoDB    | order-service                    | `@repo/order-db` (Mongoose)   | `Order`                                                                                                                                 |
| MongoDB    | cart-service                     | `@repo/cart-db` (Mongoose)    | `Cart`, `ProcessedEvent`                                                                                                                |
| Clerk      | auth-service (and all frontends) | Clerk SDKs                    | users, session claims                                                                                                                   |
| Stripe     | payment-service                  | `stripe` SDK                  | products, prices, sessions                                                                                                              |

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
- There is no API gateway; frontends address services directly.
- No automated tests or CI/CD exist.
