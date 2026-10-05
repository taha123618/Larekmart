---
last_mapped_commit: 056473daac295e995dc34f9bdb56d4d180211c77
last_mapped_at: 2026-10-02
---

<!-- refreshed: 2026-10-02 -->

# Architecture

**Analysis Date:** 2026-10-02

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Client Storefront & Admin Portal                        │
│            `apps/client` (:3002)           `apps/admin` (:3003)              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Ingress Gateway / Load Balancer                        │
│              `infrastructure/kubernetes/base/ingress.yaml`                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│ Product Domain  │           │  Order Domain   │           │ Payment Domain  │
│ product-service │           │  order-service  │           │ payment-service │
│ catalog-service │           │  cart-service   │           │                 │
│  search-service │           │ shipping-service│           │                 │
└────────┬────────┘           └────────┬────────┘           └────────┬────────┘
         │                             │                             │
         └─────────────────────────────┼─────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Kafka Broker Bus (`@repo/kafka`)                        │
│            Topics: order.*, payment.*, inventory.*, product.*                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┴─────────────────────────────┐
         ▼                                                           ▼
┌─────────────────────────────────┐                 ┌─────────────────────────┐
│        Headless Workers         │                 │     Consumer Services   │
│         `email-service`         │                 │ `notification-service`  │
│   (Consumes Kafka without HTTP) │                 │   `analytic-service`    │
└─────────────────────────────────┘                 └─────────────────────────┘
```

## Component Responsibilities

| Component                | Responsibility                                                       | File                                  |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------- |
| `client`                 | Customer shopping storefront (browse, cart, checkout UI)             | `apps/client`                         |
| `admin`                  | Operations control portal (catalog, orders, inventory admin)         | `apps/admin`                          |
| `product-service`        | Authoritative product CRUD & category management                     | `apps/product-service/src/index.ts`   |
| `catalog-service`        | Read-optimized storefront catalog, facets, and caching               | `apps/catalog-service/src/index.ts`   |
| `search-service`         | OpenSearch integration, full-text product search & autocomplete      | `apps/search-service/src/index.ts`    |
| `order-service`          | Order lifecycle, MongoDB persistence, order status transitions       | `apps/order-service/src/index.ts`     |
| `cart-service`           | MongoDB cart management, guest-to-user cart merge, TTL sessions      | `apps/cart-service/src/index.ts`      |
| `payment-service`        | Stripe Checkout Sessions and Stripe webhook processing               | `apps/payment-service/src/index.ts`   |
| `inventory-service`      | PostgreSQL inventory ledger, stock reservations, warehouse tracking  | `apps/inventory-service/src/index.ts` |
| `shipping-service`       | Shipment tracking, carrier strategy adapters (DHL, FedEx, TCS)       | `apps/shipping-service/src/index.ts`  |
| `user-service`           | Customer profiles, address book, preferences                         | `apps/user-service/src/index.ts`      |
| `media-service`          | Image uploads, pre-signed S3 URLs, thumbnail transformations         | `apps/media-service/src/index.ts`     |
| `notification-service`   | Real-time WebSocket hub & notification dispatcher (Go)               | `apps/notification-service/main.go`   |
| `recommendation-service` | Vector similarity & collaborative filtering recommendations (Python) | `apps/recommendation-service/main.py` |
| `email-service`          | Headless Kafka consumer for transactional email dispatch             | `apps/email-service/src/index.ts`     |
| `@repo/kafka`            | Kafkajs producer/consumer wrapper with uniform envelope              | `packages/kafka/src/index.ts`         |
| `@repo/types`            | Shared contracts, entities, events, and Zod validation schemas       | `packages/types/src/index.ts`         |

## Pattern Overview

**Overall:** Event-Driven Microservices with Polyglot Persistence & CQRS Separation.

**Key Characteristics:**

- **Zero Inter-Service HTTP Calls:** Microservices NEVER make direct HTTP calls to other backend services. All cross-service coordination is asynchronous via Kafka topics.
- **Envelope Convention:** Every Kafka message uses the uniform `{ value: payload }` envelope convention; handlers deserialize via `message.value`.
- **CQRS Read/Write Separation:** Product mutations occur via `product-service` (PostgreSQL); storefront reads and discovery queries are served from `catalog-service` (Redis + PostgreSQL read replica) and `search-service` (OpenSearch).

## Layers

**API / Edge Layer:**

- Purpose: TLS termination, rate-limiting, CORS, route routing
- Location: `infrastructure/kubernetes/base/ingress.yaml`
- Depends on: Backend cluster services

**Application / Microservices Layer:**

- Purpose: Business domain logic, transaction handling, event emission
- Location: `apps/*-service/src`
- Depends on: `@repo/types`, `@repo/kafka`, `@repo/monitoring`, `@repo/*-db`

**Shared Contracts & Libraries:**

- Purpose: Shared types, database clients, telemetry, caching abstractions
- Location: `packages/*`
- Used by: Applications (`apps/*`)

## Data Flow

### Primary Checkout Request Path

1. Customer submits cart in Next.js storefront (`apps/client/src/app/cart/page.tsx`)
2. Storefront requests checkout session from `payment-service` (`apps/payment-service/src/index.ts`)
3. `payment-service` generates Stripe Checkout Session and returns redirect URL
4. Customer completes payment on Stripe; Stripe dispatches webhook to `payment-service` (`POST /api/v1/payments/webhook`)
5. `payment-service` verifies signature and produces `payment.succeeded` event to Kafka topic (`packages/kafka`)
6. `order-service` consumes `payment.succeeded`, records order document in MongoDB (`packages/order-db`), and emits `order.created`
7. `inventory-service` consumes `order.created` and commits stock reservation in PostgreSQL
8. `email-service` consumes `order.created` and transmits order confirmation email

### Search & Discovery Path

1. Storefront queries `/api/v1/search?q=jacket`
2. `search-service` executes OpenSearch multi-match query with fuzzy matching and category aggregations (`packages/opensearch`)
3. Results cached in Redis (`packages/redis`) with 60-second TTL

**State Management:**

- Distributed state managed via Kafka topic event sourcing.
- Local service transactions isolated to each service's dedicated database.

## Key Abstractions

**Kafka Producer & Consumer Wrapper:**

- Purpose: Standardized connection lifecycle, retry logic, error recovery, envelope wrapping
- Examples: `packages/kafka/src/producer.ts`, `packages/kafka/src/consumer.ts`

**Domain Entity Schemas:**

- Purpose: Runtime validation and compile-time TypeScript strict contracts
- Examples: `packages/types/src/contracts/*.ts`, `packages/types/src/events/*.ts`

## Entry Points

**Frontends:**

- `apps/client/src/app/layout.tsx` - Storefront root Next.js layout
- `apps/admin/src/app/layout.tsx` - Admin control portal root layout

**Backend Microservices:**

- `apps/*/src/index.ts` - HTTP server instantiation, Kafka consumer subscription, database connection bootstrap

## Architectural Constraints

- **Asynchronous Only:** Direct synchronous HTTP requests between backend microservices are prohibited.
- **Monorepo Boundary Isolation:** Packages cannot depend on applications; applications cannot import from sibling applications.
- **Idempotency:** All Kafka consumers must implement idempotent message handling to guard against at-least-once delivery duplicates.

## Anti-Patterns

### Direct Microservice HTTP Calls

**What happens:** Service A invokes `fetch("http://service-b:8001/api")`
**Why it's wrong:** Introduces tight temporal coupling, cascading failures, and distributed deadlocks
**Do this instead:** Publish event to Kafka (`@repo/kafka`), allowing Service B to process asynchronously

### Duplicating Contract Schemas

**What happens:** Creating local interfaces in an app for an entity owned by another service
**Why it's wrong:** Causes contract drift between producers and consumers
**Do this instead:** Import shared types and Zod schemas directly from `@repo/types`

## Error Handling

**Strategy:** Fail-safe isolation at boundaries.

**Patterns:**

- HTTP responses return standard structured JSON: `{ message: string, error?: string }`.
- Kafka consumer handlers wrap processing logic in try/catch blocks; uncaught async errors are logged with error telemetry so bad messages cannot kill the consumer loop.

---

_Architecture analysis: 2026-10-02_
