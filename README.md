# Larekmart

**Larekmart** is a production-grade microservices e-commerce platform for clothing. It pairs a customer storefront and an admin management dashboard with **nine backend services** communicating **asynchronously over Apache Kafka** and persisting data via a **polyglot architecture** (PostgreSQL for catalog, analytics, notifications, and inventory; and MongoDB for order management).

The repository is organized as a **pnpm 9 + Turborepo** monorepo: Next.js frontends, polyglot Node and Go services, and shared internal packages managed with unified tooling, strict TypeScript typing, and shared configurations.

---

## System Architecture

```
                         ┌───────────────────────┐
                         │        Clerk          │  auth + session claims (role: user|admin)
                         └───────────┬───────────┘
                                     │ Bearer JWT
         ┌───────────────────────────┼────────────────────────────┬─────────────────────────────┐
         │                           │                            │                             │
  ┌──────▼───────┐            ┌──────▼───────┐             ┌──────▼───────┐              ┌──────▼───────┐
  │   client     │            │    admin     │             │ auth-service │              │ notification │
  │  Next.js 15  │            │  Next.js 15  │             │   Express    │              │   service    │
  │   :3002      │            │   :3003      │             │   :8003      │              │  Go (Chi)    │
  └───┬──────┬───┘            └───┬───┬───┬──┘             └──────┬───────┘              │   :8005      │
      │      │                    │   │   │                       │                      └──────▲───────┘
      │      │      ┌─────────────┘   │   │                  user.created                       │
      │      │      │                 │   │                       │                             │ domain
      │      │      │                 │   │                       ▼                             │ events
  ┌───▼──────▼──────▼────┐            │   │                ┌──────────────┐                     │
  │   product-service    │            │   │                │email-service │◄────────────────────┤
  │  Express :8000       │            │   │                │  (worker)    │ email.dispatch      │
  │  Prisma → Postgres   │            │   │                └──────▲───────┘                     │
  └──────────┬───────────┘            │   │                       │                             │
             │ product.created/deleted│   │                       │ order.created               │
             ▼                        │   │                       │                             │
      ┌───────────────┐               │   │                ┌──────┴──────────┐                  │
      │  Kafka cluster│◄──────────────┼───┼────────────────┤ payment-service │                  │
      │  (3 brokers)  │               │   │                │   Hono :8002    │                  │
      └───────┬───────┘               │   │                │   Stripe        │                  │
              │                       │   │                └─────────────────┘                  │
              │ all events            │   │                                                     │
              ▼                       │   │                                                     │
  ┌───────────────────────┐           │   │                                                     │
  │   analytic-service    │           │   │                                                     │
  │   Express :8004       │◄──────────┘   │ GET /analytics (KPIs & daily charts)                │
  │   pg → PostgreSQL     │               │                                                     │
  └───────────────────────┘               │                                                     │
              ▲                           │                                                     │
              │ payment.successful        ▼                                                     │
              │                    ┌──────────────┐                                             │
              └────────────────────┤ order-service│─────────────────────────────────────────────┘
                                   │ Fastify :8001│
                                   │ Mongoose     │
                                   └──────────────┘
```

> Cross-service communication is strictly asynchronous through Kafka events. Backend services never call each other over HTTP. See [`docs/EVENT-DRIVEN-ARCHITECTURE.md`](docs/EVENT-DRIVEN-ARCHITECTURE.md) for full topic contracts.

---

## Monorepo Layout

```text
.
├── apps/
│   ├── admin/                # Next.js 15 admin dashboard (:3003)
│   ├── client/               # Next.js 15 customer storefront (:3002)
│   ├── auth-service/         # Express 5 + Clerk user management (:8003)
│   ├── order-service/        # Fastify 5 + MongoDB orders & analytics (:8001)
│   ├── payment-service/      # Hono + Stripe custom checkout & webhooks (:8002)
│   ├── product-service/      # Express 5 + Prisma catalog (:8000)
│   ├── email-service/        # Headless Kafka worker -> transactional email
│   ├── analytic-service/     # Express 5 + PostgreSQL analytics API & Kafka worker (:8004)
│   ├── notification-service/ # Go (Chi) + PostgreSQL + Redis + WebSockets notification orchestration (:8005)
│   ├── search-service/       # Fastify + OpenSearch + Redis + Kafka search and indexing (:8006)
│   ├── inventory-service/    # Hono + PostgreSQL + Redis + Kafka inventory API (:8007)
│   ├── recommendation-service/ # Python 3.12+ (FastAPI) + pgvector + Redis + Celery recommendation engine (:8008)
│   └── cart-service/          # Express 5 + MongoDB + Redis + Kafka cart management & pricing estimates (:8009)
├── packages/
│   ├── kafka/                # @repo/kafka    — kafkajs client wrapper + docker-compose
│   ├── redis/                # @repo/redis    — ioredis client, cache helpers, rate limiter + docker-compose
│   ├── opensearch/           # @repo/opensearch — OpenSearch client, mappings, query and indexing helpers
│   ├── types/                # @repo/types    — shared types, Zod schemas, event contracts
│   ├── monitoring/           # @repo/monitoring — structured logging, health checks, metrics & telemetry
│   ├── product-db/           # @repo/product-db — Prisma client & schema (PostgreSQL)
│   ├── inventory-db/         # @repo/inventory-db — Prisma inventory schema, reservations & ledger (PostgreSQL)
│   ├── order-db/             # @repo/order-db  — Mongoose connection & Order model (MongoDB)
│   ├── cart-db/              # @repo/cart-db   — Mongoose connection & Cart models (MongoDB)
│   ├── eslint-config/        # @repo/eslint-config — shared ESLint flat configs
│   └── typescript-config/    # @repo/typescript-config — shared tsconfig bases
├── docs/                     # Architecture, dependencies, conventions, testing, ADRs
├── .agents/skills/           # AI coding agent root skills
├── turbo.json                # Turborepo task pipeline
└── pnpm-workspace.yaml       # Workspace package definitions
```

---

## Applications

| Application                  | Technology Stack                                                                      | Port   | Purpose & Responsibilities                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **`client`**                 | Next.js 15, React 19, Tailwind v4, Zustand, Stripe, Clerk                             | `3002` | Customer storefront: catalog search/filter, persistent cart, Stripe custom checkout, customer order history.                                    |
| **`admin`**                  | Next.js 15, React 19, Tailwind v4, shadcn/ui, TanStack Table & Query, Recharts, Clerk | `3003` | Admin dashboard: catalog management, user administration proxy, order trends, and real-time KPI cards & charts from `analytic-service`.         |
| **`product-service`**        | Express 5, Prisma, PostgreSQL, Kafka                                                  | `8000` | Product and category catalog CRUD; publishes `product.created` and `product.deleted`.                                                           |
| **`order-service`**          | Fastify 5, Mongoose, MongoDB, Kafka                                                   | `8001` | Consumes `payment.successful`, persists orders, serves user orders and 6-month sales analytics; publishes `order.created`.                      |
| **`payment-service`**        | Hono, Stripe SDK, Kafka                                                               | `8002` | Creates Stripe checkout sessions, verifies Stripe webhooks, mirrors catalog products to Stripe; publishes `payment.successful`.                 |
| **`auth-service`**           | Express 5, Clerk Backend SDK, Kafka                                                   | `8003` | Admin user management proxying Clerk backend; publishes `user.created`.                                                                         |
| **`email-service`**          | Node.js (ESM), Nodemailer (Gmail OAuth2), Kafka                                       | —      | Headless worker consuming `user.created` (welcome) and `order.created` (order receipts).                                                        |
| **`analytic-service`**       | Express 5, Node.js (ESM), PostgreSQL (`pg`), Kafka                                    | `8004` | Consumes all event streams, updates live KPI counters, persists audit logs & daily rollups to PostgreSQL, and serves REST analytics to `admin`. |
| **`notification-service`**   | Go 1.22 (Chi), PostgreSQL, Redis, WebSockets, Kafka, OpenTelemetry                    | `8005` | Multi-channel notification orchestration (Email, SMS, Push, In-App), worker pools, Redis deduplication, and real-time WebSocket hub.            |
| **`search-service`**         | Fastify 5, OpenSearch, Redis, Kafka, Clerk                                            | `8006` | Product search, autocomplete, faceting, rate limiting, Kafka-driven indexing, and zero-downtime reindexing.                                     |
| **`inventory-service`**      | Hono 4, Prisma, PostgreSQL, Redis, Kafka, Clerk                                       | `8007` | Stock availability, atomic reservations, warehouse inventory, restocks, adjustments, and inventory events.                                      |
| **`recommendation-service`** | Python 3.12+ (FastAPI), SQLAlchemy async, PostgreSQL, pgvector, Redis, Celery, Kafka  | `8008` | Hybrid candidate generation (collaborative & content filtering, embeddings, trending velocity), interactive tester, and behavioral telemetry.   |
| **`cart-service`**           | Express 5, Mongoose, MongoDB, Redis, Kafka, Clerk                                     | `8009` | Authoritative cart persistence, guest-to-user merge, coupon management, estimated totals, and TTL expiration worker.                            |

---

## Shared Packages

| Package                       | Purpose & Exports                                                                                            | Primary Consumers                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| **`@repo/kafka`**             | Kafka client wrapper (`createKafkaClient`, `createProducer`, `createConsumer`) and local 3-broker compose.   | All backend services                                |
| **`@repo/types`**             | Central contract package: API domain types, Kafka payload interfaces, and shared Zod form schemas.           | All applications & packages                         |
| **`@repo/monitoring`**        | Framework-agnostic structured logging, health checks, metrics, and performance telemetry.                    | All applications & packages                         |
| **`@repo/redis`**             | Redis client factory, namespaced key builder, typed cache helpers, namespace invalidation, and rate limiter. | Product, order, search, analytic, and cart services |
| **`@repo/opensearch`**        | OpenSearch client factory, product mappings, query builders, indexing, search, and reindex helpers.          | Product and search services                         |
| **`@repo/product-db`**        | PostgreSQL catalog persistence via Prisma schema and generated `prisma` client singleton.                    | `product-service`, `@repo/types` (type-only)        |
| **`@repo/inventory-db`**      | PostgreSQL inventory persistence via Prisma, atomic reservations, and an inventory movement ledger.          | `inventory-service`                                 |
| **`@repo/order-db`**          | MongoDB persistence via Mongoose `Order` model and connection helper.                                        | `order-service`, `@repo/types` (type-only)          |
| **`@repo/cart-db`**           | MongoDB persistence via Mongoose `Cart` and `ProcessedEvent` models and connection helper.                   | `cart-service`, `@repo/types` (type-only)           |
| **`@repo/eslint-config`**     | Shared ESLint flat configurations (`base`, `next-js`, `react-internal`).                                     | `admin`, `client`                                   |
| **`@repo/typescript-config`** | Shared strict TypeScript compiler configurations (`base.json`, `nextjs.json`, `react-library.json`).         | All 21 workspaces                                   |

---

## Technology Stack

- **Runtime & Language**: Node.js ≥ 18, TypeScript 5.9 (Strict mode enabled across all packages), ESM (`"type": "module"`)
- **Monorepo Tooling**: pnpm 9 workspaces, Turborepo 2
- **Frontend Frameworks**: Next.js 15 (App Router, Turbopack, React Server Components), React 19
- **UI & Design System**: Tailwind CSS v4, shadcn/ui, Radix UI primitives, Lucide React, Recharts
- **State Management & Forms**: Zustand (persisted), TanStack React Query v5, TanStack Table v8, React Hook Form + Zod
- **Backend Frameworks**: Express 5, Fastify 5, Hono
- **Databases & Persistence**: PostgreSQL (via Prisma ORM & pg), MongoDB (via Mongoose)
- **Message Broker**: Apache Kafka (KafkaJS, 3-broker cluster with ZooKeeper and Kafka UI)
- **Authentication**: Clerk (`@clerk/nextjs`, `@clerk/express`, `@clerk/fastify`, `@hono/clerk-auth`)
- **Payments**: Stripe (Custom Checkout Element + Webhooks)

---

## Development Workflow

### 1. Prerequisites

- **Node.js**: ≥ 18
- **pnpm**: 9.0.0 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- **Docker**: For running the local Kafka cluster and Redis
- **Redis**: Local or containerized on port `6379` (cache for product, order, search, and analytic services)
- **OpenSearch**: Local or containerized on port `9200` (search index owned by search-service)
- **PostgreSQL**: Local or containerized on port `5432`
- **MongoDB**: Local or containerized on port `27017`

### 2. Installation & Setup

```bash
# ==============================================================================
# Option A: Full Docker Compose Environment (Recommended)
# ==============================================================================
# Spins up backing databases (Postgres with pgvector, MongoDB replica set, Redis,
# Kafka KRaft broker, OpenSearch), Kafka UI, all 13 backend services, and both Next.js frontends:
docker compose up -d --build

# View logs:
docker compose logs -f

# Stop environment (preserving data volumes):
docker compose down

# ==============================================================================
# Option B: Local Monorepo Dev (Backing Infrastructure in Docker)
# ==============================================================================
# 1. Automated monorepo setup (dependencies, .env files, AI skills sync)
pnpm run setup

# 2. Start backing infrastructure in Docker (PostgreSQL, MongoDB, Mongo-Express, Redis, Kafka, OpenSearch, Kafka UI)
docker compose up -d postgres mongo mongo-express redis kafka opensearch kafka-ui

# 3. Generate Prisma Clients & apply database migrations
pnpm --filter @repo/product-db db:generate
pnpm --filter @repo/inventory-db db:generate
pnpm --filter @repo/catalog-db db:generate
pnpm --filter @repo/shipping-db db:generate

# 4. Start all workspaces concurrently in development mode
pnpm dev
```

### 3. Core Commands

| Task                | Command                                                     | Description                                                                         |
| ------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Development**     | `pnpm dev`                                                  | Run all applications and services concurrently via Turborepo                        |
| **Scoped Dev**      | `pnpm --filter <workspace> dev`                             | Run a specific application or service (e.g. `notification-service`)                 |
| **Redis Docker**    | `docker compose -f packages/redis/docker-compose.yml up -d` | Run local Redis for the service caches and rate limiting                            |
| **Type Check**      | `pnpm check-types`                                          | Run type checking (`tsc` / `go vet`) across all 21 workspaces                       |
| **Lint**            | `pnpm lint`                                                 | Run ESLint flat checks on `admin` and `client`                                      |
| **Format**          | `pnpm format`                                               | Run Prettier across all TypeScript, TSX, and Markdown files                         |
| **Build**           | `pnpm build`                                                | Run configured builds for the Next.js apps, Node services, packages, and Go service |
| **Prisma Generate** | `pnpm --filter @repo/product-db db:generate`                | Regenerate Prisma client                                                            |
| **Prisma Migrate**  | `pnpm --filter @repo/product-db db:migrate`                 | Create and apply development migrations                                             |

---

## AI-Assisted Development System

Larekmart includes a comprehensive, hierarchical AI coding-agent operating system designed for tools like Antigravity, Claude Code, GitHub Copilot, and Cursor.

```text
Root Rules (AGENTS.md)
    ↓
Global Skills (.agents/skills/*)
    ↓
Workspace Rules (apps/*/AGENTS.md, packages/*/AGENTS.md)
    ↓
Workspace Skills (<workspace>/.agents/skills/*)
```

- **Root Instructions**: [`AGENTS.md`](./AGENTS.md) defines monorepo golden rules, the 3-stage agent lifecycle (_Before_, _While_, _After Making Changes_), and repository boundaries.
- **Global Skills (`.agents/skills/`)**:
  - `root-architecture`: Monorepo architecture map and service topology.
  - `coding-standards`: TypeScript strict conventions, ESM rules, and error response standards.
  - `debugging`: Playbooks for Kafka topic inspection, Clerk authentication, database connectivity, and SSR hydration.
  - `monorepo-development`: Workflows for pnpm workspaces, dependency management, and Turborepo pipelines.
  - `security`: Auth guards, RBAC, Stripe webhook signature validation, and secret handling.
    - `testing`: Monorepo verification guidelines, Go test coverage, and opt-in Redis integration checks.
  - `code-review`: Checklist for boundary validation, event contracts, and quality verification.
  - `documentation`: Scoped documentation rules and ADR maintenance.
- **Workspace-specific rules**: Each app and package has a scoped `AGENTS.md`. There are currently no workspace-local `.agents/skills` directories; root skills are mirrored with `pnpm run skills:sync`.

---

## Documentation Index

| Document                                                                 | Purpose & Scope                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [`docs/BRD.md`](docs/BRD.md)                                             | Business Requirement Document: goals, ROI, conversion KPIs, financial compliance     |
| [`docs/PRD.md`](docs/PRD.md)                                             | Product Requirement Document: user personas, journeys, accessibility, MVP roadmap    |
| [`docs/FRD.md`](docs/FRD.md)                                             | Functional Requirement Document: API specs, state machines, Kafka event contracts    |
| [`docs/TRD.md`](docs/TRD.md)                                             | Technical Requirement Document: topology, port matrix, SLAs, strict TS standards     |
| [`docs/MRD.md`](docs/MRD.md)                                             | Model Requirement Document: DB schemas (Postgres, Mongo), @repo/types, ML models     |
| [`docs/DATA-STRATEGY.md`](docs/DATA-STRATEGY.md)                         | Data Strategy Document: polyglot governance, event consistency, PII protection       |
| [`docs/AI-EVALUATION-FRAMEWORK.md`](docs/AI-EVALUATION-FRAMEWORK.md)     | AI Evaluation Framework: agent scoring rubrics, benchmark suites, verification steps |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                           | High-level system architecture, service responsibilities, and request flows          |
| [`docs/API.md`](docs/API.md)                                             | Comprehensive API endpoint registry across all backend services                      |
| [`docs/EVENT-DRIVEN-ARCHITECTURE.md`](docs/EVENT-DRIVEN-ARCHITECTURE.md) | Kafka topic registry, payload contracts, and event schemas                           |
| [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md)                           | Dependency graph, boundaries, and import constraints                                 |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)                             | Local development setup, port registry, and environment variables matrix             |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)                             | Coding style, naming patterns, and design principles                                 |
| [`docs/SECURITY.md`](docs/SECURITY.md)                                   | Security policies, Clerk authorization, and Stripe webhook verification              |
| [`docs/TESTING.md`](docs/TESTING.md)                                     | Testing strategy, verification commands, and automated test setup                    |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)                           | Contribution standards, git workflow, and definition of done                         |
| [`docs/adr/README.md`](docs/adr/README.md)                               | Architecture Decision Records (ADRs)                                                 |

---

## License

Private and proprietary.
