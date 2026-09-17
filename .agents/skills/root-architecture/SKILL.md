---
name: root-architecture
description: Use when you need to understand Larekmart's overall system design, service responsibilities, how data flows between workspaces, or where a piece of functionality lives before making changes.
---

# Root architecture

Larekmart is a microservices clothing e-commerce platform in a pnpm + Turborepo
monorepo. This skill is the orientation map; deep detail is in `docs/ARCHITECTURE.md`.

## Mental model

- **Two frontends** own all user interaction and call backend services over HTTP with a
  Clerk Bearer token: `client` (storefront, :3002) and `admin` (dashboard, :3003).
- **Eight HTTP backend services & two workers** own business logic and each owns its data:
  - `product-service` (:8000) — catalog, PostgreSQL via Prisma.
  - `order-service` (:8001) — orders, MongoDB via Mongoose.
  - `payment-service` (:8002) — Stripe; stateless.
  - `auth-service` (:8003) — Clerk user management; stateless.
  - `analytic-service` (:8004) — KPI counters, PostgreSQL audit logs & metrics REST API.
  - `notification-service` (:8005) — Go (Chi), multi-channel notifications (Email, SMS, Push, In-App), PostgreSQL, Redis, WebSockets.
  - `search-service` (:8006) — Fastify, full-text product search, autocomplete, facets; OpenSearch + Redis cache.
  - `inventory-service` (:8007) — Hono, PostgreSQL stock authority, atomic reservations, warehouse inventory, and Kafka events.
  - `recommendation-service` (:8008) — Python 3.12+ (FastAPI), collaborative & content filtering, pgvector embeddings, trending algorithms, Celery worker.
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
| Kafka client/producer/consumer helpers             | `packages/kafka`                                       |
| Shared types, Zod schemas, Kafka payload types     | `packages/types`                                       |
| Telemetry, structured logging, health checks       | `packages/monitoring`                                  |
| OpenSearch client, mappings, query builders        | `packages/opensearch`                                  |
| Product/category DB schema                         | `packages/product-db`                                  |
| Inventory DB schema and transactions               | `packages/inventory-db`                                |
| Order persistence schema                           | `packages/order-db`                                    |
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
