# Larekmart

**Larekmart** is a production-grade microservices e-commerce platform for clothing. It pairs a customer storefront and an admin management dashboard with five backend services communicating **asynchronously over Apache Kafka** and persisting data via a **polyglot architecture** (PostgreSQL for the product catalog and MongoDB for order management).

The repository is organized as a **pnpm 9 + Turborepo** monorepo: Next.js frontends, Node services, and shared internal packages managed with unified tooling, strict TypeScript typing, and shared configurations.

---

## System Architecture

```
                         ┌───────────────────────┐
                         │        Clerk          │  auth + session claims (role: user|admin)
                         └───────────┬───────────┘
                                     │ Bearer JWT
         ┌───────────────────────────┼────────────────────────────┐
         │                           │                            │
  ┌──────▼───────┐            ┌──────▼───────┐             ┌──────▼───────┐
  │   client     │            │    admin     │             │ auth-service │
  │  Next.js 15  │            │  Next.js 15  │             │   Express    │
  │   :3002      │            │   :3003      │             │   :8003      │
  └───┬──────┬───┘            └───┬──────┬───┘             └──────┬───────┘
      │      │                    │      │                        │
      │      │      ┌─────────────┘      │                   user.created
      │      │      │                    │                        │
      │      │      │                    │                        ▼
  ┌───▼──────▼──────▼────┐      ┌────────▼─────────┐       ┌──────────────┐
  │   product-service    │      │  order-service   │       │email-service │
  │  Express :8000       │      │  Fastify :8001   │       │  (worker)    │
  │  Prisma → Postgres   │      │  Mongoose → Mongo│       └──────▲───────┘
  └──────────┬───────────┘      └───────▲──────────┘              │
             │ product.created/deleted  │ payment.successful      │
             ▼                          │                         │ order.created
      ┌───────────────┐           ┌─────┴──────────┐              │
      │  Kafka cluster│◄──────────┤ payment-service├──────────────┘
      │  (3 brokers)  │           │  Hono :8002    │
      └───────────────┘           │  Stripe        │
                                  └────────────────┘
```

> Cross-service communication is strictly asynchronous through Kafka events. Backend services never call each other over HTTP. See [`docs/EVENT-DRIVEN-ARCHITECTURE.md`](docs/EVENT-DRIVEN-ARCHITECTURE.md) for full topic contracts.

---

## Monorepo Layout

```text
.
├── apps/
│   ├── admin/             # Next.js 15 admin dashboard (:3003)
│   ├── client/            # Next.js 15 customer storefront (:3002)
│   ├── auth-service/      # Express 5 + Clerk user management (:8003)
│   ├── order-service/     # Fastify 5 + MongoDB orders & analytics (:8001)
│   ├── payment-service/   # Hono + Stripe custom checkout & webhooks (:8002)
│   ├── product-service/   # Express 5 + Prisma catalog (:8000)
│   ├── email-service/     # Headless Kafka worker -> transactional email
│   └── analytic-service/  # Headless Kafka worker -> metrics aggregation & PostgreSQL audit logs
├── packages/
│   ├── kafka/             # @repo/kafka    — kafkajs client wrapper + docker-compose
│   ├── types/             # @repo/types    — shared types, Zod schemas, event contracts
│   ├── product-db/        # @repo/product-db — Prisma client & schema (PostgreSQL)
│   ├── order-db/          # @repo/order-db  — Mongoose connection & Order model (MongoDB)
│   ├── eslint-config/     # @repo/eslint-config — shared ESLint flat configs
│   └── typescript-config/ # @repo/typescript-config — shared tsconfig bases
├── docs/                  # Architecture, dependencies, conventions, testing, ADRs
├── .agents/skills/        # AI coding agent root skills
├── turbo.json             # Turborepo task pipeline
└── pnpm-workspace.yaml    # Workspace package definitions
```

---

## Applications

| Application            | Technology Stack                                                                      | Port   | Purpose & Responsibilities                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **`client`**           | Next.js 15, React 19, Tailwind v4, Zustand, Stripe, Clerk                             | `3002` | Customer storefront: catalog search/filter, persistent cart, Stripe custom checkout, customer order history.                    |
| **`admin`**            | Next.js 15, React 19, Tailwind v4, shadcn/ui, TanStack Table & Query, Recharts, Clerk | `3003` | Admin dashboard: product/category catalog management, user administration proxy, order trends analytics.                        |
| **`product-service`**  | Express 5, Prisma, PostgreSQL, Kafka                                                  | `8000` | Product and category catalog CRUD; publishes `product.created` and `product.deleted`.                                           |
| **`order-service`**    | Fastify 5, Mongoose, MongoDB, Kafka                                                   | `8001` | Consumes `payment.successful`, persists orders, serves user orders and 6-month sales analytics; publishes `order.created`.      |
| **`payment-service`**  | Hono, Stripe SDK, Kafka                                                               | `8002` | Creates Stripe checkout sessions, verifies Stripe webhooks, mirrors catalog products to Stripe; publishes `payment.successful`. |
| **`auth-service`**     | Express 5, Clerk Backend SDK, Kafka                                                   | `8003` | Admin user management proxying Clerk backend; publishes `user.created`.                                                         |
| **`email-service`**    | Node.js (ESM), Nodemailer (Gmail OAuth2), Kafka                                       | —      | Headless worker consuming `user.created` (welcome) and `order.created` (order receipts).                                        |
| **`analytic-service`** | Express 5, Node.js (ESM), PostgreSQL, Kafka                                           | `8004` | Hybrid worker & REST API aggregating cross-service events into real-time metrics & PostgreSQL audit logs.                       |

---

## Shared Packages

| Package                       | Purpose & Exports                                                                                          | Primary Consumers                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **`@repo/kafka`**             | Kafka client wrapper (`createKafkaClient`, `createProducer`, `createConsumer`) and local 3-broker compose. | All backend services                         |
| **`@repo/types`**             | Central contract package: API domain types, Kafka payload interfaces, and shared Zod form schemas.         | All applications & packages                  |
| **`@repo/product-db`**        | PostgreSQL catalog persistence via Prisma schema and generated `prisma` client singleton.                  | `product-service`, `@repo/types` (type-only) |
| **`@repo/order-db`**          | MongoDB persistence via Mongoose `Order` model and connection helper.                                      | `order-service`, `@repo/types` (type-only)   |
| **`@repo/eslint-config`**     | Shared ESLint flat configurations (`base`, `next-js`, `react-internal`).                                   | `admin`, `client`                            |
| **`@repo/typescript-config`** | Shared strict TypeScript compiler configurations (`base.json`, `nextjs.json`, `react-library.json`).       | All 14 workspaces                            |

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
- **Docker**: For running the local Kafka cluster
- **PostgreSQL**: Local or containerized on port `5432`
- **MongoDB**: Local or containerized on port `27017`

### 2. Installation & Setup

```bash
# Automated monorepo setup (installs all workspace dependencies, initializes .env files, syncs AI skills)
pnpm run setup

# Or step-by-step:
pnpm run install:all                      # install all workspace packages
pnpm run env:setup                        # safely initialize all .env files
pnpm run skills:sync                      # sync canonical .agents/skills to AI agent folders

# Start local Kafka cluster (3 brokers + Kafka UI at http://localhost:8080)
docker compose -f packages/kafka/docker-compose.yml up -d

# Generate Prisma Client & apply database migrations
pnpm --filter @repo/product-db db:generate
pnpm --filter @repo/product-db db:migrate

# Start all workspaces concurrently in development mode
pnpm dev
```

### 3. Core Commands

| Task                | Command                                      | Description                                                 |
| ------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| **Development**     | `pnpm dev`                                   | Run all applications and services in watch mode             |
| **Scoped Dev**      | `pnpm --filter <workspace> dev`              | Run a specific application or service                       |
| **Type Check**      | `pnpm check-types`                           | Run `tsc --noEmit` across all 14 workspaces                 |
| **Lint**            | `pnpm lint`                                  | Run ESLint flat checks on `admin` and `client`              |
| **Format**          | `pnpm format`                                | Run Prettier across all TypeScript, TSX, and Markdown files |
| **Build**           | `pnpm build`                                 | Compile Next.js production bundles and `payment-service`    |
| **Prisma Generate** | `pnpm --filter @repo/product-db db:generate` | Regenerate Prisma client                                    |
| **Prisma Migrate**  | `pnpm --filter @repo/product-db db:migrate`  | Create and apply development migrations                     |

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
  - `testing`: Monorepo verification guidelines and recipe for introducing Vitest.
  - `code-review`: Checklist for boundary validation, event contracts, and quality verification.
  - `documentation`: Scoped documentation rules and ADR maintenance.
- **Workspace Skills**: Targeted playbooks for specific domains (e.g. `apps/client/.agents/skills/storefront-flow`, `apps/admin/.agents/skills/admin-dashboard`, `apps/payment-service/.agents/skills/stripe-lifecycle`, `packages/kafka/.agents/skills/kafka-event-system`, `packages/product-db/.agents/skills/prisma-schema-migrations`).

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
