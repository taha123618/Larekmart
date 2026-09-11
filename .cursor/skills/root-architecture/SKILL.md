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
- **Four services** own business logic and each owns its data:
  - `product-service` (:8000) — catalog, PostgreSQL via Prisma.
  - `order-service` (:8001) — orders, MongoDB via Mongoose.
  - `payment-service` (:8002) — Stripe; stateless.
  - `auth-service` (:8003) — Clerk user management; stateless.
  - `email-service` — no HTTP; a Kafka worker that sends email.
- **Backend services never call each other over HTTP.** They integrate through Kafka
  topics (see `docs/EVENT-DRIVEN-ARCHITECTURE.md`).

## Where does X live?

| Need to change…                                | Go to                                                  |
| ---------------------------------------------- | ------------------------------------------------------ |
| Storefront UI/UX, cart, checkout               | `apps/client`                                          |
| Admin tables, forms, charts                    | `apps/admin`                                           |
| Products/categories + product events           | `apps/product-service`                                 |
| Orders, order analytics                        | `apps/order-service`                                   |
| Stripe sessions, webhooks, Stripe sync         | `apps/payment-service`                                 |
| User admin CRUD, `user.created`                | `apps/auth-service`                                    |
| Emails for user/order events                   | `apps/email-service`                                   |
| Kafka client/producer/consumer helpers         | `packages/kafka`                                       |
| Shared types, Zod schemas, Kafka payload types | `packages/types`                                       |
| Product/category DB schema                     | `packages/product-db`                                  |
| Order persistence schema                       | `packages/order-db`                                    |
| TS/ESLint baselines                            | `packages/typescript-config`, `packages/eslint-config` |

## Data ownership

Each service owns its store; never reach into another service's database. Cross-service
consistency is achieved by publishing events and letting the consumer react (eventual
consistency). E.g. a product change in Postgres is mirrored to Stripe via
`product.created`/`product.deleted`.

## Key flows

1. **Checkout:** client `POST /sessions/create-checkout-session` → Stripe session →
   client confirms → Stripe `checkout.session.completed` webhook → payment-service
   publishes `payment.successful` → order-service persists an Order and publishes
   `order.created` → email-service sends an order email.
2. **User creation:** admin `POST /users` → auth-service creates the Clerk user →
   publishes `user.created` → email-service sends a welcome email.
3. **Product creation:** admin `POST /products` → product-service writes Prisma →
   publishes `product.created` → payment-service creates a Stripe product.

## Before changing anything

1. Read the workspace `AGENTS.md` for the code you are editing.
2. Check `docs/DEPENDENCIES.md` if your change touches package boundaries or public APIs.
3. If you touch an event, update producers, consumers, `@repo/types`, and
   `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.
