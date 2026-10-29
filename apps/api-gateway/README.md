# API Gateway — Larekmart Microservices Platform

The **Larekmart API Gateway** is the single public HTTP entry point for storefront clients (`client`), back-office administration (`admin`), mobile applications, and third-party integrations. Built with **Node.js, TypeScript, and Fastify 5**, it provides centralized routing, authentication enforcement, rate limiting, request correlation, security middleware, resilience patterns, and observability without moving domain business logic into the gateway layer.

---

## 1. Architectural Role

```text
                              ┌─────────────────────────────┐
                              │  Storefront / Admin / Apps  │
                              └──────────────┬──────────────┘
                                             │  (Public HTTP / WS)
                                             ▼
                              ┌─────────────────────────────┐
                              │     Larekmart API Gateway   │
                              │       Fastify 5 (Port 8080) │
                              └──────────────┬──────────────┘
                                             │
               ┌─────────────────────────────┼─────────────────────────────┐
               │ (Private Docker Network)    │                             │
               ▼                             ▼                             ▼
         auth-service                  user-service                 product-service
         (Port 8003)                   (Port 8012)                   (Port 8000)
               │                             │                             │
               ▼                             ▼                             ▼
         catalog-service               cart-service                  order-service
         (Port 8010)                   (Port 8009)                   (Port 8001)
               │                             │                             │
               ▼                             ▼                             ▼
         search-service               payment-service              inventory-service
         (Port 8006)                   (Port 8002)                   (Port 8007)
               │                             │                             │
               ▼                             ▼                             ▼
        shipping-service            notification-service         recommendation-service
         (Port 8011)                   (Port 8005)                   (Port 8008)
               │                             │                             │
               ▼                             ▼                             ▼
         media-service                analytic-service                    Redis
         (Port 8013)                   (Port 8004)                   (Distributed Limiter)
```

The gateway acts as the **security and routing boundary**:

1. **Request Correlation:** Generates or validates `x-request-id` and sets standard W3C `traceparent` headers.
2. **Client Header Sanitization:** Removes any client-supplied internal headers (`x-user-id`, `x-user-role`, `x-user-is-super-admin`, `x-user-is-seller`, `x-user-can-manage-sellers`, `x-internal-secret`) _before_ rewriting and proxying to upstreams.
3. **Authentication Verification:** Verifies Clerk session tokens, extracts identity claims, and injects trusted identity headers alongside the validated `x-internal-secret`.
4. **Distributed Rate Limiting:** Enforces Redis-backed sliding-window rate limits per policy tier (AUTH, PUBLIC_READ, SEARCH, PAYMENT, ADMIN) with local memory fallback.
5. **Resilience:** Circuit breaking, configurable upstream timeouts, and idempotent retries (only safe GET/HEAD requests, never payment/order writes).
6. **Error Normalization:** Uniform error structures without leaking internal IPs, database connection strings, or stack traces.

---

## 2. Directory Structure

```text
apps/api-gateway/
├── src/
│   ├── app.ts                  # Fastify application factory & middleware pipeline
│   ├── server.ts               # Server bootstrap & graceful signal shutdown
│   ├── index.ts                # Application process entrypoint
│   │
│   ├── config/
│   │   ├── env.ts              # Zod-validated environment schema
│   │   ├── services.ts         # Service target configurations
│   │   └── routes.ts           # Route mappings re-export
│   │
│   ├── gateway/
│   │   ├── service-registry.ts # Downstream microservice definitions & timeouts
│   │   ├── route-registry.ts   # Consolidated public, authenticated & admin routes
│   │   ├── policies.ts         # Rate limiting & request size policies
│   │   └── proxy.ts            # Fastify HTTP proxy registration & header rewrites
│   │
│   ├── auth/
│   │   ├── token-verifier.ts   # Clerk token & claims resolution
│   │   ├── auth-middleware.ts  # PreHandler identity injection
│   │   └── authorization.ts    # requireAuth, requireAdmin, requireSeller guards
│   │
│   ├── middleware/
│   │   ├── request-id.ts       # Correlation ID & header sanitization
│   │   ├── tracing.ts          # W3C traceparent extraction & propagation
│   │   ├── rate-limit.ts       # Redis sliding-window rate limiter
│   │   ├── security.ts         # Helmet defensive security headers
│   │   ├── cors.ts             # Strict CORS origin & exposed headers
│   │   └── error-handler.ts    # Sanitized global error handler
│   │
│   ├── routing/
│   │   ├── public.routes.ts    # Public endpoints (auth, catalog, search, etc.)
│   │   ├── authenticated.routes.ts # User-authenticated endpoints (cart, orders, etc.)
│   │   └── admin.routes.ts     # Admin-only endpoints (analytics, media admin, charts)
│   │
│   ├── aggregation/
│   │   └── home.ts             # Read-only homepage aggregation (catalog + recommendations)
│   │
│   ├── resilience/
│   │   ├── timeout.ts          # Per-service timeout configurations
│   │   ├── retry.ts            # Safe idempotent retry policy
│   │   ├── circuit-breaker.ts  # Circuit breaker (CLOSED, OPEN, HALF_OPEN)
│   │   ├── singleflight.ts     # Thundering-herd promise coalescing
│   │   └── in-flight-bulkhead.ts # Dynamic concurrency bulkhead limiter
│   │
│   ├── cache/
│   │   └── redis.ts            # Redis client manager & health check
│   │
│   ├── schemas/
│   │   ├── gateway.ts          # Route, tier, and policy schemas
│   │   └── errors.ts           # Error code & payload schemas
│   │
│   ├── observability/
│   │   ├── metrics.ts          # Prometheus metrics registry
│   │   └── tracing.ts          # Distributed tracing helpers
│   │
│   └── errors/
│       └── errors.ts           # Standard gateway transport error classes
│
├── tests/
│   ├── index.test.ts           # Master test runner
│   ├── unit/                   # Route registry, circuit breaker, and retry tests
│   ├── auth/                   # Authorization guard tests
│   ├── resilience/             # Chaos guardrails & in-flight bulkhead tests
│   ├── security/               # Header sanitization & error scrubbing tests
│   └── integration/            # Health, metrics & aggregation endpoint tests
│
├── Dockerfile                  # Hardened multi-stage non-root container image
├── package.json
└── tsconfig.json
```

---

## 3. Public Route Mapping Table

| Public Prefix               | Target Microservice             | Mount / Rewrite           | Auth Tier     | Timeout  |
| :-------------------------- | :------------------------------ | :------------------------ | :------------ | :------- |
| `/api/v1/auth/*`            | `auth-service` (8003)           | `""`                      | Public        | 5,000ms  |
| `/api/v1/catalog/*`         | `catalog-service` (8010)        | `/api/v1/catalog`         | Public        | 5,000ms  |
| `/api/v1/products/*`        | `product-service` (8000)        | `/products`               | Public        | 5,000ms  |
| `/api/v1/categories/*`      | `product-service` (8000)        | `/categories`             | Public        | 5,000ms  |
| `/api/v1/search/*`          | `search-service` (8006)         | `/api/v1/search`          | Public        | 3,000ms  |
| `/api/v1/recommendations/*` | `recommendation-service` (8008) | `/api/v1/recommendations` | Public        | 6,000ms  |
| `/api/v1/users/*`           | `user-service` (8012)           | `/api/v1/users`           | Authenticated | 5,000ms  |
| `/api/v1/cart/*`            | `cart-service` (8009)           | `/api/v1/cart`            | Authenticated | 5,000ms  |
| `/api/v1/orders/*`          | `order-service` (8001)          | `/orders`                 | Authenticated | 10,000ms |
| `/api/v1/payments/*`        | `payment-service` (8002)        | `""`                      | Authenticated | 15,000ms |
| `/api/v1/inventory/*`       | `inventory-service` (8007)      | `/api/v1/inventory`       | Authenticated | 5,000ms  |
| `/api/v1/shipping/*`        | `shipping-service` (8011)       | `/api/v1/shipping`        | Authenticated | 10,000ms |
| `/api/v1/tracking/*`        | `shipping-service` (8011)       | `/api/v1/tracking`        | Public        | 10,000ms |
| `/api/v1/notifications/*`   | `notification-service` (8005)   | `/notifications` (WS)     | Authenticated | 5,000ms  |
| `/api/v1/media/*`           | `media-service` (8013)          | `/api/v1/media`           | Public Read   | 15,000ms |
| `/api/v1/admin/media/*`     | `media-service` (8013)          | `/api/v1/admin/media`     | Admin Only    | 15,000ms |
| `/api/v1/reviews/*`         | `review-service` (8014)         | `/api/v1/reviews`         | Public / User | 5,000ms  |
| `/api/v1/admin/reviews/*`   | `review-service` (8014)         | `/api/v1/admin/reviews`   | Admin Only    | 5,000ms  |
| `/api/v1/vendors/*`         | `vendor-service` (8020)         | `/api/v1/vendors`         | User / Admin  | 10,000ms |
| `/api/v1/sellers/*`         | `seller-service` (8021)         | `/api/v1/sellers`         | User / Admin  | 10,000ms |
| `/api/v1/storefronts/*`     | `seller-service` (8021)         | `""`                      | Public        | 5,000ms  |
| `/api/v1/system-settings`   | `seller-service` (8021)         | `""`                      | Public        | 3,000ms  |
| `/api/v1/admin/delegations` | `seller-service` (8021)         | `""`                      | Admin Only    | 5,000ms  |
| `/order-chart`              | `order-service` (8001)          | `/order-chart`            | Admin Only    | 10,000ms |
| `/api/v1/analytics/*`       | `analytic-service` (8004)       | `/analytics`              | Admin Only    | 5,000ms  |
| `/api/v1/home`              | _Gateway Aggregated_            | _Internal Fan-out_        | Public        | 2,500ms  |

---

## 4. Security & Authentication Architecture

### Header Sanitization

Incoming requests from public clients may attempt to spoof internal identity headers. The gateway strips the following client headers immediately upon arrival:

- `x-user-id`
- `x-user-role`
- `x-user-permissions`
- `x-user-is-seller`
- `x-user-can-manage-sellers`
- `x-internal-secret`

### Trusted Header Propagation

After validating the Clerk session token, the gateway injects trusted headers for downstream consumption:

- `x-request-id` — UUIDv4 request correlation ID
- `x-user-id` — Authenticated Clerk customer ID
- `x-user-role` — Resolved role (`customer`, `seller`, `admin`, `super_admin`)
- `x-user-is-seller` — Set to `true` when user has verified seller privileges
- `x-user-can-manage-sellers` — Set to `true` when caller is Super Admin or has `manage_sellers` administrative delegation
- `x-internal-secret` — Shared secret (`INTERNAL_SERVICE_SECRET`) for downstream microservice verification
- `traceparent` — W3C distributed trace context (`00-{traceId}-{spanId}-01`)

---

## 5. Rate Limiting Policies

Configured via Redis distributed sliding window with automatic memory fallback:

| Policy Tier     | Limit   | Window | Target Routes                                   |
| :-------------- | :------ | :----- | :---------------------------------------------- |
| **AUTH**        | 15 req  | 60 sec | `/api/v1/auth/*`                                |
| **PAYMENT**     | 20 req  | 60 sec | `/api/v1/payments/*`, `/sessions/*`             |
| **CHECKOUT**    | 30 req  | 60 sec | `/api/v1/checkout/*`                            |
| **ADMIN**       | 60 req  | 60 sec | `/api/v1/admin/*`, `/analytics`, `/order-chart` |
| **SEARCH**      | 120 req | 60 sec | `/api/v1/search/*`                              |
| **PUBLIC_READ** | 300 req | 60 sec | `/api/v1/catalog/*`, `/api/v1/products/*`       |
| **DEFAULT**     | 100 req | 60 sec | All other API routes                            |

---

## 6. Resilience & Reliability

1. **Service Timeouts:** Downstream requests enforce strict timeout bounds preventing gateway connection exhaustion (fast search: 3s; catalog/cart/user: 5s; order/shipping: 10s; payment/media: 15s).
2. **Circuit Breakers:** Per-service circuit breaker tracking (`CLOSED`, `OPEN`, `HALF_OPEN`). After 5 consecutive failures, the circuit trips to `OPEN` for 15 seconds, returning fast 503 errors without overloading struggling services.
3. **Safe Retries:** Conservative retry policy. Only safe idempotent methods (`GET`, `HEAD`) encountering transient network errors (`ECONNRESET`, `ETIMEDOUT`) are retried. Non-idempotent writes (`POST` orders, `POST` payments) are never automatically retried.
4. **Thundering-Herd Shielding (`SingleFlightGroup`):** In-flight promise coalescing in `src/resilience/singleflight.ts` deduplicates concurrent cache misses on high-traffic read routes (`GET /api/v1/home`, `GET /api/v1/inventory/:productId/availability`), ensuring only a single request reaches downstream databases while identical concurrent calls share the resolved promise.
5. **In-Flight Concurrency Bulkheads (`InFlightBulkhead`):** Limits instantaneous concurrent active requests per route category (`50` max concurrent in healthy state; dynamically clamped to `5` during degraded or tripped states). Excess requests are shed immediately with HTTP `503 Service Unavailable` and `Retry-After: 15`, isolating gateway event loops from hanging socket pools during downstream database outages.
6. **Dynamic Adaptive Rate Limiting:** Rate limit maximums (`getAdaptiveRateLimitForRoute`) inspect downstream circuit breaker health. When `order-service` or `payment-service` experiences degradation, checkout rate limits are automatically clamped from 30 down to 5 req/min, insulating database connection pools until the circuit breaker recovers.

---

## 7. Observability & Health

### Health Endpoints

- `GET /health`: Process liveness check.
- `GET /health/live`: Kubernetes / Docker liveness probe.
- `GET /health/ready`: Readiness probe verifying configuration and Redis availability.

### Prometheus Metrics

Exposed at `GET /metrics`:

- `gateway_requests_total`: Total incoming requests (labels: `method`, `route`).
- `gateway_request_duration_seconds`: Request duration histogram.
- `gateway_request_errors_total`: Gateway error counts.
- `gateway_rate_limit_hits_total`: Rate limit rejections.
- `gateway_auth_failures_total`: Authentication/authorization rejections.
- `gateway_proxy_requests_total`: Downstream proxy dispatches.
- `gateway_proxy_errors_total`: Downstream service errors.
- `gateway_proxy_timeouts_total`: Downstream service timeouts.
- `gateway_proxy_retries_total`: Safe transient retries.
- `gateway_circuit_breaker_open_total`: Circuit breaker trip count.
- `gateway_4xx_total` & `gateway_5xx_total`: Status code distribution.

---

## 8. Development & Testing

```bash
# Run unit and integration test suite
pnpm --filter api-gateway test

# Run TypeScript typecheck
pnpm --filter api-gateway check-types

# Build compiled distribution
pnpm --filter api-gateway build

# Start local development server with hot-reload
pnpm --filter api-gateway dev
```
