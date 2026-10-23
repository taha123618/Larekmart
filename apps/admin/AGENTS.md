# AGENTS.md — apps/admin (dashboard)

Scope: `apps/admin` only. Root rules still apply — start there.

## What this app is

Next.js 15 (App Router, Turbopack) admin dashboard on `:3003`. It owns product/category
management, user administration (against Clerk), and an order dashboard with charts. It
calls backend services via the unified API Gateway (`NEXT_PUBLIC_API_GATEWAY_URL`, port `8080`)
and uses shadcn/ui, TanStack Query, TanStack Table, Recharts, and react-hook-form + Zod.

## Where things live

- `src/app/` — App Router routes. Look for `(dashboard)` for the protected admin shell and
  `(auth)` for clerk sign-in / unauthorized fallback.
- `src/components/` — UI: `AddProduct`, `AddCategory`, `CardList`, `AddUser`, data tables,
  chart components, `BackfillSearchButton`, `CacheStatsTable`, etc.
- `src/lib/cache-stats.ts` — scrapes each service's `/metrics` and shapes the cache
  hit/miss/error counters for the Cache Performance page (`/cache`), including the
  per-service `hitRateOf` / `errorRateOf` computations.
- `src/components/ui/` — shadcn/ui primitives. Add new primitives here when you need one.
- `src/lib/utils.ts` — contains `cn()`.
- `src/middleware.ts` — admin routing guard using `createRouteMatcher` and
  `sessionClaims.metadata.role === "admin"`.

## Remix-style rules for this app

- **Server components by default.** Use `"use client"` only where you need interactivity.
- **Admin access is enforced both ways:**
  - Frontend: `src/middleware.ts` protects the dashboard routes and redirects non-admins.
  - Backend: services still enforce authorization. Do not rely on the frontend gate alone.
- **Data fetching in server components:** `auth()` from `@clerk/nextjs/server` for session
  info; fetch service data with `Authorization: Bearer <token>` and
  `process.env.NEXT_PUBLIC_*_SERVICE_URL`.
- **Interactive screens:** TanStack Query (`useQuery`/`useMutation`) for mutations and
  polling-heavy screens. Forms use `react-hook-form` + Zod.
- **Tables:** TanStack Table with per-section column definitions.
- **Charts:** Recharts for dashboard analytics.
- **UI:** shadcn/ui under `src/components/ui`. Keep `cn()` usage consistent with the rest
  of the app. Icons from `lucide-react`. Toasts via `react-toastify`.
- **Styling:** Tailwind v4 + CSS variables in `src/app/globals.css`. Prefer existing palette
  classes over raw hex.

## Auth model

- Clerk frontend with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Server-side Clerk with `CLERK_SECRET_KEY` and `@clerk/nextjs/server`.
- Admin role is `sessionClaims.metadata.role === "admin"`.
- Super Admin role is `sessionClaims.metadata.role === "super_admin"` or `sessionClaims.metadata.isSuperAdmin === true`. Super Admin has exclusive permissions to toggle project-wide seller functionality (`isSellerEnabled`) in `/settings`.
- User admin operations in the UI call `auth-service` over HTTP with a Clerk token. The
  service enforces admin-only access.

## Backend calls from this app

This app talks HTTP to:

- `product-service` — products, categories, and the admin search-index backfill
  (`POST /products/backfill-search`, surfaced as **Rebuild search index** on the products
  page). That endpoint is **windowed**: `BackfillSearchButton` keeps calling it with
  `afterId` until the response reports `hasMore: false`, showing a running count. It
  republishes catalog products as `product.updated` events, and the actual indexing happens
  asynchronously in search-service — so a success toast means the events were **queued**,
  not that the index is already rebuilt.
- `order-service` — orders, order chart.
- `auth-service` — user admin (list, get, create, delete).
- `shipping-service` (`NEXT_PUBLIC_SHIPPING_SERVICE_URL` :8011) — logistics dashboard, shipments, multi-carrier adapters, rates, label printing, and tracking.
- `recommendation-service` (`NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL` :8008) — live health checks (`/health/live`), strategy metrics (`/api/v1/analytics/metrics`), interactive tester (`/api/v1/recommendations/*`), and overview popular product fallback (`/api/v1/recommendations/popular`).
- `review-service` (`NEXT_PUBLIC_REVIEW_SERVICE_URL` :8014) — review moderation queue (`/api/v1/admin/reviews/pending`), approval/rejection actions (`/api/v1/admin/reviews/:id/moderate`), abuse reports, and rating summary recalibration.
- `promotion-service` (`NEXT_PUBLIC_PROMOTION_SERVICE_URL` :8016) — promotional campaigns dashboard (`/promotions`), coupon code generation, promotion activation/deactivation, and redemption history.
- `tax-service` (`NEXT_PUBLIC_TAX_SERVICE_URL` :8017 / `/taxes`) — executive tax compliance dashboard, configurable versioned tax rules, tax jurisdictions, customer exemptions, and calculation audit logs.
- `return-service` (`NEXT_PUBLIC_RETURN_SERVICE_URL` :8018 / `/returns`) — multi-seller returns management dashboard (`/returns`), RMA review, approval/rejection dialogs, warehouse item inspection modal (disposition and restock decisions), return shipment tracking, and Stripe refund retry execution.
- `pricing-service` (`NEXT_PUBLIC_PRICING_SERVICE_URL` :8090 / :8019) — authoritative merchandise pricing, seller price lists (B2B & B2C), multi-currency exchange rates, tiered volume pricing rules, and pricing audit history.
- `vendor-service` (`NEXT_PUBLIC_VENDOR_SERVICE_URL` :8020 / `/vendors`) — legal business entities, merchant onboarding, KYB verification queue, document review, and organization status controls.
- `seller-service` (`NEXT_PUBLIC_SELLER_SERVICE_URL` :8021 / `/sellers` / `/settings`) — marketplace storefront management, staff permissions, operational settings, policies, seller performance monitoring, and project-wide Super Admin governance (`/settings`, `isSellerEnabled` toggle).
- every caching service — its `/metrics` endpoint, for the **Cache Performance** page
  (`/cache`). That page reads `cache_hits_total` / `cache_misses_total` / `cache_errors_total`
  from search-service, product-service, analytic-service, and order-service, and reports a
  service as `unavailable` instead of failing when it cannot be reached. The counters are read
  live (`dynamic = "force-dynamic"`), so never prerender that page at build time.
  `cache_errors_total` (reads that failed because Redis was unreachable) is shown separately from
  misses on purpose — the page must let an outage be told apart from a cold cache.
  Each service card reports a hit rate and an **error rate** side by side so services can be
  compared at a glance. Error rate is `errors / (hits + misses + errors)` while hit rate excludes
  errors, so a service reading "100% hit rate, 4% errors" is healthy _and_ occasionally unable to
  reach Redis. Both are computed in `cache-stats.ts`; keep that arithmetic there rather than in
  the component.
  Cards are **ordered by error rate, highest first** (`rankByErrorRate`) so a failing cache is the
  first thing on the page. A `null` rate — no traffic yet, or `/metrics` unreadable — sorts below
  every real rate rather than being treated as `0%`; otherwise a service that simply is not running
  locally would crowd out the real signal. Ties keep the configured order from
  `getCacheServiceTargets()`. That ranking rule lives in `cache-stats.ts` too — the component only
  renders the result, and the per-cache breakdown table stays in configured order.
- It does not touch Postgres/Mongo/Kafka directly.

Follow the existing fetch pattern with Clerk token + service URL env vars. If you add a new
Route Handler in this app, mirror the existing Clerk token pattern rather than inventing a
new one.

## What not to do

- Do not weaken the admin middleware to “make things easier.”
- Do not put mutating admin actions behind only a UI guard; the backend must still authorize.
- Do not import service internals into the frontend.
- Do not paste raw hex colors; use Tailwind classes and existing design tokens.
- Do not duplicate Zod schemas from `@repo/types` when the existing ones fit.

## Verification

- `pnpm --filter admin check-types`
- `pnpm --filter admin build`
- `pnpm lint` (runs on client and admin together from the root)

If you change admin CRUD flows, test against running services. There is no general
JavaScript test runner in this repo yet; verification uses type-checking, builds, linting,
and manual flows.
