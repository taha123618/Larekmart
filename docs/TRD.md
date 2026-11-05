# Technical Requirement Document (TRD) — Larekmart E-Commerce Platform

## 1. System Architecture & Topology

Larekmart is implemented as a **pnpm 9 + Turborepo 2 monorepo** with strict boundary separation between frontend presentation layers, shared contract packages, and backend microservices communicating via Apache Kafka.

```
+-----------------------------------------------------------------------------------+
|                              Presentation Layer (Next.js 15)                       |
|   apps/client (:3002) - Storefront           apps/admin (:3003) - Dashboard       |
+----------------------------------------+------------------------------------------+
                                         | HTTP / JWT Session Claims
                                         v
+-----------------------------------------------------------------------------------+
|                              Microservices Layer (26 Services)                     |
|  product-service (:8000)   order-service (:8001)     payment-service (:8002)       |
|  auth-service (:8003)      analytic-service (:8004)  notification-service (:8005)  |
|  search-service (:8006)    inventory-service (:8007) recommendation-service (:8008)|
|  cart-service (:8009)      catalog-service (:8010)   shipping-service (:8011)      |
|  user-service (:8012)      media-service (:8013)     review-service (:8014)        |
|  wishlist-service (:8015)  promotion-service (:8016) tax-service (:8017)           |
|  return-service (:8018)    pricing-service (:8019)   vendor-service (:8020)        |
|  seller-service (:8021)    commission-service (:8022) payout-service (:8023)       |
|  fraud-service (:8024)     support-service (:8025)   email-service (Worker)        |
+----------------------------------------+------------------------------------------+
                                         | Asynchronous Event Streams
                                         v
+-----------------------------------------------------------------------------------+
|                           Messaging & Persistence Layer                           |
|  Apache Kafka (3 Brokers)   PostgreSQL (Prisma & pg)   MongoDB (Mongoose)         |
+-----------------------------------------------------------------------------------+
```

---

## 2. Workspace Specifications & Runtime Matrix

| Workspace                         | Type    | Runtime / Framework               | Port   | Primary Dependencies                                                | Storage          |
| :-------------------------------- | :------ | :-------------------------------- | :----- | :------------------------------------------------------------------ | :--------------- |
| **`apps/client`**                 | App     | Next.js 16 (App Router), React 19 | `3002` | `@clerk/nextjs`, `@repo/types`, `zustand`, `stripe`                 | LocalStorage     |
| **`apps/admin`**                  | App     | Next.js 15 (App Router), React 19 | `3003` | `@clerk/nextjs`, `@repo/types`, `@tanstack/react-table`, `recharts` | —                |
| **`apps/api-gateway`**            | Gateway | Fastify 5 (Node ESM)              | `8080` | `@fastify/http-proxy`, `@clerk/fastify`, `@repo/redis`, `opossum`   | Redis            |
| **`apps/product-service`**        | Service | Express 5 (Node ESM)              | `8000` | `@clerk/express`, `@repo/product-db`, `@repo/kafka`, `@repo/types`  | PostgreSQL       |
| **`apps/order-service`**          | Service | Fastify 5 (Node ESM)              | `8001` | `@clerk/fastify`, `@repo/order-db`, `@repo/kafka`, `@repo/types`    | MongoDB          |
| **`apps/payment-service`**        | Service | Hono (Node ESM)                   | `8002` | `@hono/clerk-auth`, `@repo/kafka`, `@repo/types`, `stripe`          | Stripe API       |
| **`apps/auth-service`**           | Service | Express 5 (Node ESM)              | `8003` | `@clerk/express`, `@repo/kafka`, `@repo/types`                      | Clerk API        |
| **`apps/email-service`**          | Worker  | Node.js (ESM)                     | —      | `@repo/kafka`, `@repo/types`, `nodemailer`                          | —                |
| **`apps/analytic-service`**       | Hybrid  | Go 1.22 + Chi                     | `8004` | `chi`, `pgx/v5`, `kafka-go`, `go-redis/v9`, `prometheus`            | PostgreSQL / Mem |
| **`apps/notification-service`**   | Service | Go 1.22 + Chi                     | `8005` | `chi`, `pgx/v5`, `kafka-go`, `gorilla/websocket`                    | PostgreSQL       |
| **`apps/search-service`**         | Service | Fastify 5 (Node ESM)              | `8006` | `@repo/opensearch`, `@repo/kafka`, `@repo/redis`                    | OpenSearch       |
| **`apps/inventory-service`**      | Service | Hono 4 (Node ESM)                 | `8007` | `@repo/inventory-db`, `@repo/redis`, `@repo/kafka`                  | PostgreSQL       |
| **`apps/recommendation-service`** | Service | Python 3.12+ (FastAPI)            | `8008` | `fastapi`, `sqlalchemy`, `asyncpg`, `pgvector`, `celery`            | PostgreSQL       |
| **`apps/cart-service`**           | Service | Express 5 (Node ESM)              | `8009` | `@repo/cart-db`, `@repo/redis`, `@repo/kafka`                       | MongoDB          |
| **`apps/catalog-service`**        | Service | Fastify 5 (Node ESM)              | `8010` | `@repo/catalog-db`, `@repo/redis`, `@repo/kafka`                    | PostgreSQL       |
| **`apps/shipping-service`**       | Service | Koa (Node ESM)                    | `8011` | `@repo/shipping-db`, `@repo/redis`, `@repo/kafka`                   | PostgreSQL       |
| **`apps/user-service`**           | Service | Fastify 5 (Node ESM)              | `8012` | `@repo/user-db`, `@repo/redis`, `@repo/kafka`                       | PostgreSQL       |
| **`apps/media-service`**          | Service | Hono 4 (Node ESM)                 | `8013` | `drizzle-orm`, `@aws-sdk/client-s3`, `sharp`                        | MinIO / S3       |
| **`apps/review-service`**         | Service | Fastify 5 (Node ESM)              | `8014` | `drizzle-orm`, `@repo/redis`, `@repo/kafka`                         | PostgreSQL       |
| **`apps/wishlist-service`**       | Service | Fastify 5 (Node ESM)              | `8015` | `drizzle-orm`, `@repo/redis`, `@repo/kafka`                         | PostgreSQL       |
| **`apps/promotion-service`**      | Service | Hono 4 (Node ESM)                 | `8016` | `drizzle-orm`, `@repo/redis`, `@repo/kafka`                         | PostgreSQL       |
| **`apps/tax-service`**            | Service | Fastify 5 (Node ESM)              | `8017` | `drizzle-orm`, `mysql2`, `@repo/redis`, `@repo/kafka`               | MySQL            |
| **`apps/return-service`**         | Service | Koa 2 (Node ESM)                  | `8018` | `drizzle-orm`, `mysql2`, `@repo/redis`, `@repo/kafka`               | MySQL            |
| **`apps/pricing-service`**        | Service | Fastify 5 (Node ESM)              | `8019` | `drizzle-orm`, `decimal.js`, `@repo/redis`, `@repo/kafka`           | PostgreSQL       |
| **`apps/vendor-service`**         | Service | NestJS 11 (Fastify 5)             | `8020` | `@repo/vendor-db`, `@repo/redis`, `@repo/kafka`                     | PostgreSQL       |
| **`apps/seller-service`**         | Service | Fastify 5 (Node ESM)              | `8021` | `drizzle-orm`, `@repo/redis`, `@repo/kafka`                         | PostgreSQL       |
| **`apps/commission-service`**     | Service | Fastify 5 (Node ESM)              | `8022` | `drizzle-orm`, `decimal.js`, `@repo/redis`, `@repo/kafka`           | PostgreSQL       |
| **`apps/payout-service`**         | Service | NestJS 11 (Fastify 5)             | `8023` | `drizzle-orm`, `decimal.js`, `@repo/redis`, `@repo/kafka`           | PostgreSQL       |
| **`apps/fraud-service`**          | Service | Python 3.12+ (FastAPI)            | `8024` | `fastapi`, `sqlalchemy`, `asyncpg`, `scikit-learn`, `aiokafka`      | PostgreSQL       |
| **`apps/support-service`**        | Service | NestJS 11 (Fastify 5)             | `8025` | `@repo/support-db`, `@repo/redis`, `@repo/kafka`, `socket.io`       | PostgreSQL       |
| **`packages/kafka`**              | Library | TypeScript (Node ESM)             | —      | `kafkajs`                                                           | —                |
| **`packages/types`**              | Library | TypeScript                        | —      | `zod`, `@repo/product-db`, `@repo/order-db`                         | —                |
| **`packages/monitoring`**         | Library | TypeScript (Node ESM)             | —      | — (Zero framework dependencies)                                     | —                |
| **`packages/redis`**              | Library | TypeScript (Node ESM)             | —      | `ioredis`                                                           | Redis            |
| **`packages/opensearch`**         | Library | TypeScript (Node ESM)             | —      | `@opensearch-project/opensearch`                                    | OpenSearch       |
| **`packages/product-db`**         | Library | TypeScript (Prisma Client)        | —      | `@prisma/client`, `prisma`                                          | PostgreSQL       |
| **`packages/inventory-db`**       | Library | TypeScript (Prisma Client)        | —      | `@prisma/client`, `prisma`                                          | PostgreSQL       |
| **`packages/order-db`**           | Library | TypeScript (Mongoose)             | —      | `mongoose`                                                          | MongoDB          |
| **`packages/cart-db`**            | Library | TypeScript (Mongoose)             | —      | `mongoose`                                                          | MongoDB          |
| **`packages/catalog-db`**         | Library | TypeScript (Prisma Client)        | —      | `@prisma/client`, `prisma`                                          | PostgreSQL       |
| **`packages/shipping-db`**        | Library | TypeScript (Prisma Client)        | —      | `@prisma/client`, `prisma`                                          | PostgreSQL       |
| **`packages/user-db`**            | Library | TypeScript (Prisma Client)        | —      | `@prisma/client`, `prisma`                                          | PostgreSQL       |
| **`packages/vendor-db`**          | Library | TypeScript (Prisma Client)        | —      | `@prisma/client`, `prisma`                                          | PostgreSQL       |
| **`packages/support-db`**         | Library | TypeScript (Prisma Client)        | —      | `@prisma/client`, `prisma`                                          | PostgreSQL       |
| **`packages/eslint-config`**      | Config  | ESLint Flat Config (v9)           | —      | `@eslint/js`, `typescript-eslint`, `@next/eslint-plugin-next`       | —                |
| **`packages/typescript-config`**  | Config  | Shared tsconfig bases             | —      | `typescript@5.9.2`                                                  | —                |

---

## 3. Cross-Cutting Technical Standards

### 3.1 Strict TypeScript & Compiler Standard

All packages inherit from [`@repo/typescript-config/base.json`](file:///Users/taha/projects/microservices-ecommerce/packages/typescript-config/base.json):

- `"strict": true`
- `"noUncheckedIndexedAccess": true`
- `"isolatedModules": true`
- `"moduleResolution": "bundler"`
- `"module": "ESNext"`

### 3.2 Kafka Envelope & Delivery Conventions

- **Producer Envelope**: All messages must be enveloped as `{ value: payload }`.
- **Consumer Parsing**: Handlers receive parsed JSON and extract `message.value || message`.
- **Topic Subscriptions**: Consumers configure `fromBeginning: true` and must be idempotent.
- **Fault Tolerance**: Handlers catch and log async errors to prevent partition stalling or consumer crashes.

### 3.3 Authentication & Authorization

- **Clerk Identity**: Handled via Clerk SDKs (`@clerk/nextjs`, `@clerk/express`, `@clerk/fastify`, `@hono/clerk-auth`).
- **Route Guards**:
  - `shouldBeUser`: Verifies valid `userId`.
  - `shouldBeAdmin`: Validates `sessionClaims.metadata.role === "admin"`.
  - `shouldBeSellerOrAdmin`: Validates active seller identity or admin role.

### 3.4 Financial Precision & Balanced Double-Entry Accounting Standard (`Decimal.js`)

- **Zero Floating-Point Drift**: All monetary, rate, and fee arithmetic across `commission-service` and `payout-service` strictly uses `Decimal.js` with `Decimal.ROUND_HALF_UP`.
- **Append-Only Ledger**: Payout balances are computed dynamically from `ledger_entries` (`SUM(credits) - SUM(debits)`). Account state is never stored as a mutable balance scalar.
- **Balanced Transaction Invariant**: Every journal entry batch strictly satisfies `SUM(debits) == SUM(credits)`.
- **Versioned Rule Auditing**: Commission rules stamp immutable versions (`commission_rule_versions`) on calculation snapshots to guarantee settled payouts are never retroactively corrupted.
- **Distributed Idempotency**: Financial disbursement batches and payout executions enforce unique idempotency keys via Redis atomic leases.

---

## 4. Performance & Scalability SLAs

| Metric                     | Target SLA       | Strategy                                                              |
| :------------------------- | :--------------- | :-------------------------------------------------------------------- |
| **API Response Time**      | P95 < 150ms      | Lightweight frameworks (Hono, Fastify, Express 5), indexed DB queries |
| **Event Delivery Latency** | P99 < 200ms      | 3-broker distributed Kafka cluster with partition distribution        |
| **Build & Compilation**    | Incremental < 5s | Turborepo pipeline caching and topological execution                  |
| **Cold Start Resilience**  | < 2s startup     | Auto-reconnecting database pools and lazy client initialization       |
