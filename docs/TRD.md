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
|                              Microservices Layer                                  |
|  product-service (:8000)  order-service (:8001)  payment-service (:8002)          |
|  auth-service (:8003)     analytic-service (:8004) email-service (Worker)         |
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

| Workspace                        | Type    | Runtime / Framework               | Port   | Primary Dependencies                                                | Storage          |
| :------------------------------- | :------ | :-------------------------------- | :----- | :------------------------------------------------------------------ | :--------------- |
| **`apps/client`**                | App     | Next.js 15 (App Router), React 19 | `3002` | `@clerk/nextjs`, `@repo/types`, `zustand`, `stripe`                 | LocalStorage     |
| **`apps/admin`**                 | App     | Next.js 15 (App Router), React 19 | `3003` | `@clerk/nextjs`, `@repo/types`, `@tanstack/react-table`, `recharts` | —                |
| **`apps/product-service`**       | Service | Express 5 (Node ESM)              | `8000` | `@clerk/express`, `@repo/product-db`, `@repo/kafka`, `@repo/types`  | PostgreSQL       |
| **`apps/order-service`**         | Service | Fastify 5 (Node ESM)              | `8001` | `@clerk/fastify`, `@repo/order-db`, `@repo/kafka`, `@repo/types`    | MongoDB          |
| **`apps/payment-service`**       | Service | Hono (Node ESM)                   | `8002` | `@hono/clerk-auth`, `@repo/kafka`, `@repo/types`, `stripe`          | Stripe API       |
| **`apps/auth-service`**          | Service | Express 5 (Node ESM)              | `8003` | `@clerk/express`, `@repo/kafka`, `@repo/types`                      | Clerk API        |
| **`apps/email-service`**         | Worker  | Node.js (ESM)                     | —      | `@repo/kafka`, `@repo/types`, `nodemailer`                          | —                |
| **`apps/analytic-service`**      | Hybrid  | Express 5 + Node Worker           | `8004` | `@clerk/express`, `@repo/kafka`, `@repo/types`, `pg`                | PostgreSQL / Mem |
| **`packages/kafka`**             | Library | TypeScript (Node ESM)             | —      | `kafkajs`                                                           | —                |
| **`packages/types`**             | Library | TypeScript                        | —      | `zod`, `@repo/product-db`, `@repo/order-db`                         | —                |
| **`packages/monitoring`**        | Library | TypeScript (Node ESM)             | —      | — (Zero framework dependencies)                                     | —                |
| **`packages/product-db`**        | Library | TypeScript (Prisma Client)        | —      | `@prisma/client`, `prisma`                                          | PostgreSQL       |
| **`packages/order-db`**          | Library | TypeScript (Mongoose)             | —      | `mongoose`                                                          | MongoDB          |
| **`packages/eslint-config`**     | Config  | ESLint Flat Config (v9)           | —      | `@eslint/js`, `typescript-eslint`, `@next/eslint-plugin-next`       | —                |
| **`packages/typescript-config`** | Config  | Shared tsconfig bases             | —      | `typescript@5.9.2`                                                  | —                |

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

---

## 4. Performance & Scalability SLAs

| Metric                     | Target SLA       | Strategy                                                              |
| :------------------------- | :--------------- | :-------------------------------------------------------------------- |
| **API Response Time**      | P95 < 150ms      | Lightweight frameworks (Hono, Fastify, Express 5), indexed DB queries |
| **Event Delivery Latency** | P99 < 200ms      | 3-broker distributed Kafka cluster with partition distribution        |
| **Build & Compilation**    | Incremental < 5s | Turborepo pipeline caching and topological execution                  |
| **Cold Start Resilience**  | < 2s startup     | Auto-reconnecting database pools and lazy client initialization       |
