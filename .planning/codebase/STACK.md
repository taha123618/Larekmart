---
last_mapped_commit: 056473daac295e995dc34f9bdb56d4d180211c77
last_mapped_at: 2026-10-02
---
# Technology Stack

**Analysis Date:** 2026-10-02

## Languages

**Primary:**
- TypeScript 5.9.2 - Core language across frontends (`apps/client`, `apps/admin`), 13 Node backend services (`apps/*-service`), and shared libraries (`packages/*`)
- JavaScript (Node ESM / Node.js 20 LTS) - Tooling scripts (`scripts/*.js`, `scripts/*.cjs`), config files (`eslint.config.mjs`)

**Secondary:**
- Go 1.22 - Real-time notification and WebSocket hub (`apps/notification-service`)
- Python 3.12 - Hybrid AI recommendation and pgvector inference engine (`apps/recommendation-service`)
- Shell (Bash / POSIX sh) - Deployment, container audit, and CI automation (`scripts/docker-scout-audit.sh`, `scripts/verify-staging-traffic.sh`)

## Runtime

**Environment:**
- Node.js 20 LTS (Alpine Linux 3.20 base in container runtimes)
- Go 1.22 Runtime (`golang:1.22-alpine` builder, `alpine:3.20` runner)
- Python 3.12 (`ghcr.io/astral-sh/uv:python3.12-bookworm-slim` multi-stage runner)

**Package Manager:**
- pnpm 9.0.0 (Strict monorepo workspace resolution defined in `package.json`)
- uv (Fast Python package manager for `apps/recommendation-service/pyproject.toml`)
- Lockfile: `pnpm-lock.yaml` present, `uv.lock` present

## Frameworks

**Core:**
- Next.js 15 (App Router, React 19) - Storefront frontend (`apps/client/package.json`) and Admin portal (`apps/admin/package.json`)
- Express 5 - REST APIs for `product-service`, `auth-service`, `analytic-service`, and `cart-service`
- Fastify 5 - High-performance REST APIs for `order-service`, `search-service`, `catalog-service`, and `user-service`
- Hono 4 - Lightweight edge-ready APIs for `payment-service`, `inventory-service`, and `media-service`
- Koa 2 - Shipment lifecycle and carrier adapter API (`apps/shipping-service/package.json`)
- Chi Router (Go) - Lightweight HTTP router and WebSocket hub (`apps/notification-service/main.go`)
- FastAPI 0.115 - Asynchronous recommendation endpoints (`apps/recommendation-service/main.py`)

**Testing:**
- Node Test Runner / Standalone TSX Runners - Microservice unit tests (`tests/index.test.ts` in services)
- Pytest 8.3 - Python test suite (`apps/recommendation-service/tests/`)
- Go test (`go test ./...` in `apps/notification-service`)

**Build/Dev:**
- Turborepo 2.5.6 - Monorepo task orchestration (`turbo.json`)
- TypeScript compiler (`tsc --noEmit`) across 29 workspaces
- Prettier 3.6.2 - Code formatting across all workspaces
- ESLint 9 - Flat configuration (`packages/eslint-config`)

## Key Dependencies

**Critical:**
- `kafkajs` ^2.2.4 - Kafka broker bus integration (`packages/kafka/package.json`)
- `@clerk/clerk-sdk-node` & `@clerk/nextjs` - Authentication & user identity across all frontends and services
- `stripe` ^17.7.0 - Stripe Checkout Sessions and payment webhook handling (`apps/payment-service/package.json`)
- `ioredis` ^5.6.1 - Redis connection pooling, distributed locks, and cache caching (`packages/redis/package.json`)
- `@opensearch-project/opensearch` ^2.14.0 - Product search catalog indexing and vector queries (`packages/opensearch/package.json`)
- `zod` ^3.24.2 - Cross-cutting runtime validation and contract schemas (`packages/types/package.json`)

**Infrastructure:**
- `@prisma/client` ^6.4.1 - ORM for PostgreSQL databases (`packages/product-db`, `packages/inventory-db`, `packages/catalog-db`, `packages/shipping-db`, `packages/user-db`)
- `mongoose` ^8.12.1 - ODM for MongoDB document stores (`packages/order-db`, `packages/cart-db`)
- `drizzle-orm` ^0.40.0 - Lightweight ORM for media metadata database (`apps/media-service/package.json`)
- `prom-client` ^15.1.3 - Prometheus metrics instrumentation (`packages/monitoring/package.json`)

## Configuration

**Environment:**
- Centralized `.env.example` templates per service and app
- Environment setup script: `scripts/setup-env.js` executed via `pnpm env:setup`
- Required variables: `PORT`, `KAFKA_BROKERS`, `POSTGRES_URL`, `MONGODB_URI`, `REDIS_HOST`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`

**Build:**
- Root orchestrator: `turbo.json`
- Base TypeScript configuration: `packages/typescript-config/base.json`
- Next.js base config: `packages/typescript-config/nextjs.json`
- Docker multi-stage builds: `apps/*/Dockerfile`

## Platform Requirements

**Development:**
- Node.js >= 18.0.0
- pnpm >= 9.0.0
- Docker Desktop or Docker Engine with Docker Compose (v2.20+)
- Python >= 3.12 (via `uv`) and Go >= 1.22

**Production:**
- Kubernetes 1.28+ cluster (orchestrated via Kustomize in `infrastructure/kubernetes/`)
- Ingress: NGINX Ingress Controller (`ingress-nginx`)
- Container Registry: Docker Hub / OCI compliant registry with Docker Hardened Images (DHI)

---

*Stack analysis: 2026-10-02*
