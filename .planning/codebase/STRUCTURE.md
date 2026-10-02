---
last_mapped_commit: 056473daac295e995dc34f9bdb56d4d180211c77
last_mapped_at: 2026-10-02
---
# Codebase Structure

**Analysis Date:** 2026-10-02

## Directory Layout

```
microservices-ecommerce/
├── apps/                         # Frontends and 15 deployable microservices
│   ├── admin/                    # Next.js 15 operations portal (:3003)
│   ├── analytic-service/         # Express metrics aggregator (:8004)
│   ├── auth-service/             # Express Clerk RBAC proxy (:8003)
│   ├── cart-service/             # Express MongoDB cart engine (:8009)
│   ├── catalog-service/          # Fastify read-optimized catalog (:8010)
│   ├── client/                   # Next.js 15 storefront (:3002)
│   ├── email-service/            # Headless Kafka consumer worker
│   ├── inventory-service/        # Hono stock & warehouse ledger (:8007)
│   ├── media-service/            # Hono image upload & variant API (:8013)
│   ├── notification-service/     # Go 1.22 Chi WebSocket & notification hub (:8005)
│   ├── order-service/            # Fastify MongoDB order manager (:8001)
│   ├── payment-service/          # Hono Stripe checkout & webhook engine (:8002)
│   ├── product-service/          # Express PostgreSQL product catalog (:8000)
│   ├── recommendation-service/   # Python 3.12 FastAPI pgvector recommender (:8008)
│   ├── search-service/           # Fastify OpenSearch query router (:8006)
│   ├── shipping-service/         # Koa carrier adapter engine (:8011)
│   └── user-service/             # Fastify profile & address manager (:8012)
├── packages/                     # 11 shared libraries & configuration packages
│   ├── cart-db/                  # Mongoose models for cart
│   ├── catalog-db/               # Prisma schema & client for catalog read-model
│   ├── eslint-config/            # Shared ESLint 9 flat configurations
│   ├── inventory-db/             # Prisma schema & client for inventory
│   ├── kafka/                    # Kafkajs producer/consumer wrapper
│   ├── monitoring/               # Prometheus metrics & health check helpers
│   ├── opensearch/               # OpenSearch client factory & query builders
│   ├── order-db/                 # Mongoose models for orders
│   ├── product-db/               # Prisma schema & client for products
│   ├── redis/                    # ioredis client factory & cache helpers
│   ├── shipping-db/              # Prisma schema & client for shipping
│   ├── types/                    # Shared entities, events, contracts & Zod schemas
│   ├── typescript-config/        # Base tsconfig files
│   └── user-db/                  # Prisma schema & client for users
├── infrastructure/               # Cloud infrastructure & deployment manifests
│   ├── kubernetes/               # Base manifests & environment overlays (dev, staging, prod)
│   └── observability/            # Prometheus, Grafana, Alertmanager, Loki configs
├── scripts/                      # Setup, sync, scout audit, and validation scripts
├── docs/                         # Architecture, Docker, testing, and ADR documentation
└── security/                     # OpenVEX statements and CycloneDX SBOMs
```

## Directory Purposes

**`apps/`:**
- Purpose: Application entry points and runtime containers
- Contains: Frontends (Next.js), REST APIs (Node.js/Go/Python), headless workers
- Key files: `apps/*/Dockerfile`, `apps/*/package.json`, `apps/*/src/index.ts`

**`packages/`:**
- Purpose: Reusable libraries, database clients, contracts, and configs
- Contains: TypeScript packages shared across `apps/`
- Key files: `packages/types/src/index.ts`, `packages/kafka/src/index.ts`

**`infrastructure/`:**
- Purpose: Declarative Kubernetes Kustomize manifests and observability configs
- Key files: `infrastructure/kubernetes/base/kustomization.yaml`, `infrastructure/kubernetes/base/ingress.yaml`

**`scripts/`:**
- Purpose: Monorepo operational tooling, AI skills sync, and Docker Scout security automation
- Key files: `scripts/docker-scout-audit.sh`, `scripts/sync-skills.js`, `scripts/setup-env.js`

## Key File Locations

**Entry Points:**
- `apps/client/src/app/page.tsx` - Storefront home page
- `apps/admin/src/app/page.tsx` - Admin control dashboard
- `apps/*/src/index.ts` - Microservices Node.js server entrypoints
- `apps/notification-service/main.go` - Go WebSocket server entrypoint
- `apps/recommendation-service/main.py` - FastAPI entrypoint

**Configuration:**
- `package.json` - Root monorepo workspace configuration
- `turbo.json` - Turborepo build pipeline and task dependency graph
- `docker-compose.yml` - Local multi-container orchestration
- `docker-compose.observability.yml` - Metrics & logging stack

**Core Logic:**
- `packages/kafka/src/producer.ts` - Kafka event publication
- `packages/types/src/events/` - Kafka event schemas and contracts
- `packages/monitoring/src/metrics.ts` - Prometheus application metrics registry

## Naming Conventions

**Files:**
- TypeScript modules: `kebab-case.ts` (e.g. `order-service.ts`)
- React components: `kebab-case.tsx` or `PascalCase.tsx`
- Documentation & ADRs: `UPPERCASE.md` or `kebab-case.md`

**Directories:**
- Microservices: `apps/<name>-service`
- Database packages: `packages/<domain>-db`

## Where to Add New Code

**New Microservice:**
- Location: `apps/<name>-service/`
- Add to `package.json` workspaces
- Create Dockerfile with multi-stage non-root build
- Create Kubernetes deployment in `infrastructure/kubernetes/base/services/<name>-service.yaml`
- Add route to `infrastructure/kubernetes/base/ingress.yaml`

**New Event Contract / Shared Type:**
- Location: `packages/types/src/events/<event-name>.ts`
- Export from `packages/types/src/index.ts`

**New Database Schema / Migration:**
- Relational (PostgreSQL): `packages/<domain>-db/prisma/schema.prisma`
- Document (MongoDB): `packages/<domain>-db/src/models/`

## Special Directories

**`.planning/`:**
- Purpose: GSD workflow state, project roadmap, and codebase intelligence maps
- Generated: Managed by GSD CLI
- Committed: Yes

**`packages/*-db/generated/`:**
- Purpose: Generated Prisma client code
- Generated: Yes (via `pnpm db:generate`)
- Committed: No (gitignored)

---

*Structure analysis: 2026-10-02*
