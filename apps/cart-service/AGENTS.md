# AGENTS.md — apps/cart-service

Scope: `apps/cart-service` only. Root rules apply.

## What this service is

Express 5 microservice on port `:8009` owning server-side cart persistence, anonymous guest cart sessions, transactional cart merges, optimistic concurrency versioning, Redis caching and expiration scheduling, and Kafka cart lifecycle events.

## Tech Stack

- **Framework**: Express 5 (ESM, TypeScript strict)
- **Database**: MongoDB via `@repo/cart-db` (**Mongoose strictly, NO Prisma**)
- **Cache & Expirations**: Redis (`@repo/redis`)
- **Messaging**: Apache Kafka (`@repo/kafka`)
- **Contracts & Validation**: Zod (`@repo/types`)
- **Observability**: `@repo/monitoring` (structured logging, health checks, Prometheus `/metrics`)

## Endpoints

- `GET /api/v1/cart` — Retrieve active cart (authenticated user or guest)
- `GET /api/v1/cart/summary` — Lightweight cart summary
- `POST /api/v1/cart/items` — Add item to cart
- `PATCH /api/v1/cart/items/:item_id` — Update item quantity (0 removes item)
- `DELETE /api/v1/cart/items/:item_id` — Remove item from cart
- `POST /api/v1/cart/merge` — Transactionally merge guest cart into user cart upon login
- `POST /api/v1/cart/coupons` — Apply coupon code
- `DELETE /api/v1/cart/coupons/:code` — Remove coupon code
- `DELETE /api/v1/cart` — Clear all items and coupons
- `POST /api/v1/cart/refresh-pricing` — Revalidate product prices against catalog
- `GET /health` — Multi-dependency health report (Memory, MongoDB, Redis)
- `GET /metrics` — Prometheus metrics exposition

## Events

- **Emits**: `cart.created`, `cart.item_added`, `cart.item_updated`, `cart.item_removed`, `cart.merged`, `cart.coupon_added`, `cart.coupon_removed`, `cart.expired`, `cart.cleared`
- **Consumes**: `product.updated`, `product.deleted`, `inventory.adjusted`

## Verification

```bash
pnpm --filter cart-service check-types
```
