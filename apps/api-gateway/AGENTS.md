# AGENTS.md — API Gateway

## 1. What this is

`apps/api-gateway` is the authoritative single public HTTP entry point for all storefront (client), admin, and seller applications in Larekmart.

It handles cross-cutting concerns:

- Reverse proxying to 26 backend microservices via `@fastify/http-proxy`
- Centralized CORS and defensive security headers (`@fastify/cors`, `@fastify/helmet`)
- Request correlation (`x-request-id`) and untrusted client header stripping (`x-user-id`, `x-user-role`, `x-user-is-super-admin`, `x-user-is-seller`, `x-user-can-manage-sellers`, `x-internal-secret`)
- Clerk JWT authentication and session claim extraction (`@clerk/fastify`)
- Internal trusted header injection (`x-user-id`, `x-user-role`, `x-internal-secret`, `x-user-is-seller`, `x-user-is-super-admin`, `x-user-can-manage-sellers`) executed strictly _after_ stripping untrusted headers
- Distributed rate limiting with Redis fallback (`@fastify/rate-limit`), including ONBOARDING tier (10 req/min for `/sellers` and `/vendors`), and dynamic adaptive rate-limiting clamping under downstream circuit breaker degradation
- Dynamic WAL LSN capture (`x-db-lsn`) caching into Redis via `markReadYourWritesWithLSN` for edge replica lag detection in read-heavy projections
- Robust perimeter trust proxy resolution using `FastifyServerOptions["trustProxy"]`
- Dynamic in-flight concurrency bulkheads (`InFlightBulkhead`, configurable via `GATEWAY_BULKHEAD_MAX_CONCURRENT` [default 100], `GATEWAY_BULKHEAD_DEGRADED_CONCURRENT` [default 10], `GATEWAY_BULKHEAD_QUEUE_TIMEOUT_MS` [default 2000ms]) shedding saturated traffic with HTTP 503 + `Retry-After: 15` and 10x degradation clamping when downstream circuit breakers trip (architectural blueprint: [docs/plans/hyperscale-flash-sale-architecture-hardening.md](../../docs/plans/hyperscale-flash-sale-architecture-hardening.md))
- In-flight request coalescing (`SingleFlightGroup`) protecting against Thundering Herd and Cache Stampedes on high-velocity read/aggregation endpoints
- Unified error formatting, circuit breakers, and upstream timeout handling
- Prometheus telemetry & structured JSON logging (`@repo/monitoring`)

It intentionally contains **no business domain logic**, database queries, or Kafka consumers.

## 2. Port & Upstream Route Map

Port: **8090** (standalone / Docker; 8080 reserved for Kafka UI)

| Public Route Prefix         | Upstream Service         | Port | Rewrite Prefix          |
| :-------------------------- | :----------------------- | :--- | :---------------------- |
| `/api/v1/auth`              | `auth-service`           | 8003 | `""`                    |
| `/api/v1/users`             | `user-service`           | 8012 | `/api/v1/users`         |
| `/api/v1/catalog`           | `catalog-service`        | 8010 | `/api/v1/catalog`       |
| `/api/v1/products`          | `product-service`        | 8000 | `/products`             |
| `/api/v1/categories`        | `product-service`        | 8000 | `/categories`           |
| `/api/v1/inventory`         | `inventory-service`      | 8007 | `""`                    |
| `/api/v1/cart`              | `cart-service`           | 8009 | `/api/v1/cart`          |
| `/api/v1/orders`            | `order-service`          | 8001 | `/orders`               |
| `/api/v1/user-orders`       | `order-service`          | 8001 | `/user-orders`          |
| `/api/v1/payments`          | `payment-service`        | 8002 | `""`                    |
| `/api/v1/shipping`          | `shipping-service`       | 8011 | `""`                    |
| `/api/v1/analytics`         | `analytic-service`       | 8004 | `""`                    |
| `/api/v1/notifications`     | `notification-service`   | 8005 | `""`                    |
| `/api/v1/search`            | `search-service`         | 8006 | `""`                    |
| `/api/v1/recommendations`   | `recommendation-service` | 8008 | `""`                    |
| `/api/v1/media`             | `media-service`          | 8013 | `""`                    |
| `/api/v1/reviews`           | `review-service`         | 8014 | `""`                    |
| `/api/v1/me/wishlists`      | `wishlist-service`       | 8015 | `""`                    |
| `/api/v1/promotions`        | `promotion-service`      | 8016 | `""`                    |
| `/api/v1/tax`               | `tax-service`            | 8017 | `""`                    |
| `/api/v1/returns`           | `return-service`         | 8018 | `""`                    |
| `/api/v1/prices`            | `pricing-service`        | 8019 | `""`                    |
| `/api/v1/vendors`           | `vendor-service`         | 8020 | `/api/v1/vendors`       |
| `/api/v1/sellers`           | `seller-service`         | 8021 | `/api/v1/sellers`       |
| `/api/v1/storefronts`       | `seller-service`         | 8021 | `""`                    |
| `/api/v1/system-settings`   | `seller-service`         | 8021 | `""`                    |
| `/api/v1/admin/delegations` | `seller-service`         | 8021 | `""`                    |
| `/api/v1/commissions`       | `commission-service`     | 8022 | `""`                    |
| `/api/v1/payouts`           | `payout-service`         | 8023 | `""`                    |
| `/api/v1/admin/fraud`       | `fraud-service`          | 8024 | `/api/v1/admin/fraud`   |
| `/api/v1/support`           | `support-service`        | 8025 | `/api/v1/support`       |
| `/api/v1/admin/support`     | `support-service`        | 8025 | `/api/v1/admin/support` |
| `/api/v1/admin/dlq`         | `api-gateway` (Internal) | 8090 | `""` (DLQ Ops Engine)   |

## 3. Running & Verifying

```bash
pnpm --filter api-gateway dev           # Start development server with tsx
pnpm --filter api-gateway check-types   # Typecheck
pnpm --filter api-gateway test          # Unit, auth, resilience, security & integration tests
pnpm --filter api-gateway build         # Production build
```
