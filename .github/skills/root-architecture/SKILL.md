---
name: root-architecture
description: Use when you need to understand Larekmart's overall system design, service responsibilities, how data flows between workspaces, or where a piece of functionality lives before making changes.
---

# Root architecture

**Larekmart** is a production-grade microservices e-commerce platform for market place like: amazon,daraz,ALiexpress,ALibaba and other , built in a pnpm + Turborepo
monorepo. This skill is the orientation map; deep detail is in `docs/ARCHITECTURE.md`.

## Mental model

- **Two frontends** own all user interaction and call backend services over HTTP with a
  Clerk Bearer token: `client` (storefront, :3002) and `admin` (dashboard, :3003).
- **Thirteen HTTP backend services & two headless workers** own business logic and each owns its data:
  - `product-service` (:8000) — catalog, PostgreSQL via Prisma.
  - `order-service` (:8001) — orders, MongoDB via Mongoose.
  - `payment-service` (:8002) — Stripe; stateless.
  - `auth-service` (:8003) — Clerk user management; stateless.
  - `analytic-service` (:8004) — KPI counters, PostgreSQL audit logs & metrics REST API.
  - `notification-service` (:8005) — Go (Chi), multi-channel notifications (Email, SMS, Push, In-App), PostgreSQL, Redis, WebSockets.
  - `search-service` (:8006) — Fastify, full-text product search, autocomplete, facets; OpenSearch + Redis cache.
  - `inventory-service` (:8007) — Hono, PostgreSQL stock authority, atomic reservations, warehouse inventory, and Kafka events.
  - `recommendation-service` (:8008) — Python 3.12+ (FastAPI), collaborative & content filtering, pgvector embeddings, trending algorithms, Celery worker.
  - `cart-service` (:8009) — Express 5, authoritative MongoDB carts, guest-to-user merge, pricing estimates, TTL expiration reaper.
  - `catalog-service` (:8010) — Fastify 5, read-optimized product discovery (categories, brands, collections) over a Prisma catalog read model.
  - `shipping-service` (:8011) — Koa, shipment lifecycle, carrier adapters (TCS/Leopards/DHL/FedEx), tracking, labels; PostgreSQL.
  - `user-service` (:8012) — Fastify 5, customer profiles, addresses, preferences; PostgreSQL via `@repo/user-db`.
  - `media-service` (:8013) — Hono 4, S3/MinIO object storage behind an `ObjectStorage` interface, Drizzle/PostgreSQL metadata, Redis-cached resolve, Sharp processing + cleanup workers.
  - `email-service` — no HTTP; a Kafka worker that sends transactional email via Nodemailer.
- **Backend services never call each other over HTTP.** They integrate through Kafka
  topics (see `docs/EVENT-DRIVEN-ARCHITECTURE.md`).

## Where does X live?

| Need to change…                                    | Go to                                                  |
| -------------------------------------------------- | ------------------------------------------------------ |
| Storefront UI/UX, cart, checkout                   | `apps/client`                                          |
| Admin tables, forms, charts                        | `apps/admin`                                           |
| Products/categories + product events               | `apps/product-service`                                 |
| Orders, order analytics                            | `apps/order-service`                                   |
| Stripe sessions, webhooks, Stripe sync             | `apps/payment-service`                                 |
| User admin CRUD, `user.created`                    | `apps/auth-service`                                    |
| Notification orchestration, SMS, Push, In-App      | `apps/notification-service`                            |
| Emails for user/order events                       | `apps/email-service`                                   |
| Analytics ingestion, KPIs, daily aggregates        | `apps/analytic-service`                                |
| Product search, autocomplete, facets, indexing     | `apps/search-service`                                  |
| Inventory availability, reservations, stock ledger | `apps/inventory-service`                               |
| AI recommendations, embeddings, user interactions  | `apps/recommendation-service`                          |
| Cart persistence, items, coupons, merge engine     | `apps/cart-service`                                    |
| Product discovery, categories, brands, collections | `apps/catalog-service`                                 |
| Shipments, rates, tracking, carrier adapters       | `apps/shipping-service`                                |
| Customer profiles, addresses, preferences          | `apps/user-service`                                    |
| Media uploads, variants, image processing          | `apps/media-service`                                   |
| Kafka client/producer/consumer helpers             | `packages/kafka`                                       |
| Shared types, Zod schemas, Kafka payload types     | `packages/types`                                       |
| Telemetry, structured logging, health checks       | `packages/monitoring`                                  |
| OpenSearch client, mappings, query builders        | `packages/opensearch`                                  |
| Product/category DB schema                         | `packages/product-db`                                  |
| Inventory DB schema and transactions               | `packages/inventory-db`                                |
| Order persistence schema                           | `packages/order-db`                                    |
| Cart persistence schema (Mongoose)                 | `packages/cart-db`                                     |
| Catalog read-model schema                          | `packages/catalog-db`                                  |
| Shipping schema, tracking events, labels           | `packages/shipping-db`                                 |
| User profiles, addresses, preferences schema       | `packages/user-db`                                     |
| TS/ESLint baselines                                | `packages/typescript-config`, `packages/eslint-config` |

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

## Before changing anything

1. Read the workspace `AGENTS.md` for the code you are editing.
2. Check `docs/DEPENDENCIES.md` if your change touches package boundaries or public APIs.
3. If you touch an event, update producers, consumers, `@repo/types`, and
   `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.
