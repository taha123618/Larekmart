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

- Sections: dashboard (charts, cards, todo), products, categories, users, orders.
- Data tables: TanStack Table with column defs per section.
- Mutations: TanStack Query `useMutation` with a Clerk token; forms use
  react-hook-form + Zod schemas from `@repo/types`.
- Image uploads go directly to Cloudinary from the browser.
- Access control: `src/middleware.ts` requires `metadata.role === "admin"`.

### Services

**`product-service` (Express 5, :8000)** — the catalog.

- Routes: `/products` (GET list, GET one, POST create, PUT/DELETE admin), `/categories`
  (GET public, mutations admin), `/health`, `/test`.
- Persistence: Prisma → PostgreSQL (`Product`, `Category`).
- Publishes `product.created` and `product.deleted` for Stripe sync.

**`order-service` (Fastify 5, :8001)** — orders and analytics.

- Routes: `/user-orders` (user-scoped), `/orders` (admin, optional `limit`),
  `/order-chart` (admin, 6-month aggregation), `/health`, `/test`.
- Persistence: Mongoose → MongoDB (`Order`, statuses `success | failed`).
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

**`notification-service` (Go 1.22 / Chi, :8005)** — unified notification orchestration.

- Routes: `/health`, `/ready`, `/metrics`, `/ws`, `/notifications`, `/notifications/unread`, `/notifications/:id/read`, `/notifications/read-all`, `/notifications/devices`, `/notifications/preferences`, `/notifications/templates`.
- Channels: Email (delegated via Kafka/email-service), SMS (provider abstraction), Push (device registry), In-App (PostgreSQL + WebSocket hub).
- Consumes: `user.created`, `order.created`, `payment.successful`, `notification.dispatch`.
- Persistence & State: PostgreSQL (`notifications`, `notification_deliveries`, `notification_preferences`, `notification_templates`, `user_devices`, `notification_events`) + Redis fast deduplication.

## Data ownership

| Store      | Owner                            | Accessed via                | Notable models                                                                                                                          |
| ---------- | -------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL | product-service                  | `@repo/product-db` (Prisma) | `Product`, `Category`                                                                                                                   |
| PostgreSQL | analytic-service                 | `pg.Pool`                   | `analytics_events`, `analytics_daily_summary`                                                                                           |
| PostgreSQL | notification-service             | `pgxpool.Pool` (Go)         | `notifications`, `notification_deliveries`, `notification_preferences`, `notification_templates`, `user_devices`, `notification_events` |
| Redis      | notification-service             | `go-redis` (Go)             | `event:<id>` (idempotency fast-cache)                                                                                                   |
| MongoDB    | order-service                    | `@repo/order-db` (Mongoose) | `Order`                                                                                                                                 |
| Clerk      | auth-service (and all frontends) | Clerk SDKs                  | users, session claims                                                                                                                   |
| Stripe     | payment-service                  | `stripe` SDK                | products, prices, sessions                                                                                                              |

`@repo/types` re-exports the persistence-derived types (`Product`, `Category`, `Order`)
so consumers can type against the catalog/order shapes without importing the DB clients
directly into their runtime.

## Key request flows

### Checkout → order → email

```
client            payment-service            Stripe              order-service        email-service
  │  POST /sessions/create-checkout-session ─▶│                   │                    │
  │                                          │ create session ──▶│                    │
  │  ◀── client_secret ───────────────────────│                   │                    │
  │  confirm() ──────────────────────────────────────────────────▶│                    │
  │                                          │  ◀ checkout.session.completed         │
  │                                          │ verify signature  │                    │
  │                                          │── payment.successful ────────────────▶│
  │                                          │                   │ createOrder        │
  │                                          │                   │── order.created ──▶│ send email
```

### Product → Stripe

```
admin ── POST /products ──▶ product-service ── write Prisma
                                 │
                                 └── product.created ──▶ payment-service ── stripe.products.create
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
