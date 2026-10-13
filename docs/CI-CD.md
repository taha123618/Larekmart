# CI/CD Pipeline Architecture & Production Operations Guide

This document is the authoritative engineering specification for the Continuous Integration and Continuous Deployment (CI/CD) pipelines in the **Larekmart** microservices monorepo.

---

## 1. System Overview & Architecture

Larekmart is a production-grade distributed microservices e-commerce platform built as a **pnpm + Turborepo monorepo**. The ecosystem consists of:

- **2 Next.js Frontends**: Storefront (`apps/client`, Next.js 16) and Admin Dashboard (`apps/admin`, Next.js 15).
- **1 Edge API Gateway**: Fastify 5 (`apps/api-gateway`).
- **14 Polyglot Backend Microservices**: Node.js (Fastify, Express, Hono, Koa), Go 1.22 (Chi), and Python 3.12+ (FastAPI).
- **1 Headless Worker**: Email Service (`apps/email-service`).
- **Shared Internal Packages**: Contracts (`@repo/types`), Event Messaging (`@repo/kafka`), Observability (`@repo/monitoring`), Caching (`@repo/redis`), Search (`@repo/opensearch`), and 7 Database Packages (`product-db`, `inventory-db`, `order-db`, `cart-db`, `catalog-db`, `shipping-db`, `user-db`).
- **Container Registry**: GitHub Container Registry (`ghcr.io/taha123618/larekmart/*`).
- **Orchestration**: Kubernetes (Kustomize overlays for `development`, `staging`, `production`) and Docker Compose.

```
                              Feature Branch / PR
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
        Pull Request to `staging`               Pull Request to `main`
                    │                                     │
                    ▼                                     ▼
     ┌─────────────────────────────────────────────────────────┐
     │                STAGE 1: Code Quality Gate               │
     │  - pnpm lint (admin + client)                           │
     │  - pnpm format:check (Prettier)                         │
     │  - pnpm db:generate (Prisma & Drizzle)                  │
     │  - pnpm check-types (Strict TypeScript compilation)     │
     │  - Secret detection & credential scanning (Trivy)       │
     └────────────────────────────┬────────────────────────────┘
                                  │
     ┌────────────────────────────┴────────────────────────────┐
     │              STAGE 2: Multi-Language Tests              │
     │  - Workspace Test Suites (Turborepo: pnpm test)         │
     │  - Go Race Detection (go test -v -race ./...)           │
     │  - Python Ruff Linting & Pytest Suite (uv run pytest)   │
     └────────────────────────────┬────────────────────────────┘
                                  │
     ┌────────────────────────────┴────────────────────────────┐
     │          STAGE 3: Build & Manifest Validation           │
     │  - Turborepo Production Build (pnpm build)              │
     │  - Kustomize Overlay Validation (dev, staging, prod)    │
     │  - Docker Compose Syntax Validation                     │
     └────────────────────────────┬────────────────────────────┘
                                  │
                    Merged / Pushed to Branch
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
   Push to `staging`                                Push to `main`
         │                                                 │
┌─────────────────────────┐                       ┌─────────────────────────┐
│ STAGE 4: Container Build│                       │ STAGE 4: Container Build│
│ - Shared Base Node Build│                       │ - Shared Base Node Build│
│ - 18 Services Matrix    │                       │ - 18 Services Matrix    │
│ - GHCR Push (:SHA,:stag)│                       │ - GHCR Push (:SHA,:late)│
│ - Trivy CVE Audit       │                       │ - Trivy CVE Audit       │
└────────────┬────────────┘                       └────────────┬────────────┘
             │                                                 │
┌────────────┴────────────┐                       ┌────────────┴────────────┐
│ STAGE 5: Staging Deploy │                       │ STAGE 5: Production Gate│
│ - DB Migrations (5 DBs) │                       │ - GitHub Environment    │
│ - Kustomize apply       │                       │   Manual Approval Gate  │
│ - 5m Rollout Watch      │                       │ - DB Migrations (5 DBs) │
│ - Synthetic Smoke Tests │                       │ - Kustomize Rolling Upd │
│ - Auto-Rollback on Fail │                       │ - Zero-Downtime Rollout │
└─────────────────────────┘                       │ - Health Verification   │
                                                  │ - Auto-Rollback on Fail │
                                                  └─────────────────────────┘
```

---

## 2. Branch-Specific Pipeline Strategies

### 2.1 `staging` Branch (Integration & Pre-Production)

- **Triggers**: Pull requests targeting `staging`, and direct merges/pushes to `staging`.
- **Purpose**: Verifies that all cross-service integrations, shared library contracts, Kafka payloads, and database migrations work harmoniously in a realistic, production-like environment before reaching production.
- **Automated Workflow**:
  1. **Fast-Fail Code Quality Gate**: Enforces ESLint, Prettier, Prisma client generation, and strict TypeScript compilation across all workspaces.
  2. **Multi-Language Testing**: Executes Turborepo tests across all 9 workspaces with test suites, Go concurrency race checks (`-race`), and Python tests.
  3. **Build Validation**: Builds Next.js frontends and compiled services to ensure zero bundle errors.
  4. **Base Node Image Build**: Builds and caches `docker/base-node/Dockerfile` to GHCR before compiling services.
  5. **Container Build Matrix**: Builds and pushes all 18 Docker images tagged with the commit SHA and `staging`.
  6. **Automated Migration Execution**: Automatically applies backward-compatible database migrations to staging databases via `db:deploy` and Drizzle migrations.
  7. **Automated Deployment**: Applies `infrastructure/kubernetes/overlays/staging` via Kustomize with immutable commit SHA image tags.
  8. **Post-Deployment Verification**: Executes `scripts/verify-staging-traffic.sh` against `https://staging.larekmart.com`, checking routes, headers, and all 14 service `/health` endpoints.
  9. **Automatic Rollback**: If rollout status or smoke tests fail, automatically triggers `kubectl rollout undo` across all affected deployments.

### 2.2 `main` Branch (Production)

- **Triggers**: Pull requests targeting `main`, and merges into `main`.
- **Purpose**: Zero-downtime, verified, auditable production deployment.
- **Automated Workflow**:
  1. **Strict Quality & Test Gates**: All stages (Code Quality, Tests, Builds, Manifests) must pass.
  2. **Base Image & Service Matrix**: Builds and publishes immutable container images (`:${SHA_SHORT}` and `:latest`).
  3. **Container Security Audit**: Trivy scans every image for CRITICAL and HIGH severity vulnerabilities.
  4. **Manual Approval Gate**: Uses GitHub Environment `production` with required reviewers and branch protection rules. Merges to production cannot be triggered without authorized approval.
  5. **Pre-Deployment Migrations**: Executes backward-compatible migrations prior to rolling updates.
  6. **Zero-Downtime Rolling Update**: Applies `infrastructure/kubernetes/overlays/production` using Kubernetes rolling update strategy (`maxSurge: 25%`, `maxUnavailable: 0`).
  7. **Production Health Checks**: Probes all public and service endpoints (`https://larekmart.com`, `https://api.larekmart.com/api/v1/*/health`).
  8. **Automated Rollback Safeguard**: If any rollout fails or times out within 5 minutes, automatically executes `kubectl rollout undo`.

---

## 3. Container Strategy & Security (DHI Standards)

### 3.1 Base Node Build Image Pattern

To optimize CI build speeds and avoid repeating pnpm/turbo installations across 16 Node Dockerfiles, the pipeline introduces a two-step build strategy:

1. `docker-base-node` builds `docker/base-node/Dockerfile` once and pushes it to `${IMAGE_PREFIX}/base-node:${SHA_SHORT}`.
2. The 16 Node Dockerfiles use `ARG BUILD_BASE_IMAGE` parameterization:
   ```dockerfile
   ARG BASE_IMAGE=node:20-alpine
   ARG BUILD_BASE_IMAGE=larekmart-base-node:latest
   FROM ${BUILD_BASE_IMAGE} AS base
   ```
   In CI, `--build-arg BUILD_BASE_IMAGE=${IMAGE_PREFIX}/base-node:${SHA_SHORT}` is injected.

### 3.2 Non-Root User Execution

All container images run as unprivileged users:

- Node.js services: `USER fastifyjs` / `USER nodejs` / `USER honojs` (UID 1001)
- Go services: `USER appuser` (UID 10001)
- Python services: `USER appuser` (UID 1001)

### 3.3 Zero Secret Embedding

- Application secrets and API keys are **never** baked into container images.
- Build-time variables (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) are passed exclusively for client asset compilation.
- Runtime secrets are mounted dynamically via Kubernetes Secrets or External Secrets Operator (ESO).

---

## 4. Environment & Secrets Management Matrix

The pipeline requires the following secrets configured in GitHub Repository Settings:

| Secret Name                         | Scope          | Description                                                |
| ----------------------------------- | -------------- | ---------------------------------------------------------- |
| `GITHUB_TOKEN`                      | Automatic      | Provided by GitHub Actions for GHCR authentication         |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Global / Build | Frontend Clerk auth key                                    |
| `STAGING_KUBECONFIG`                | Staging        | Kubeconfig for Staging Kubernetes Cluster                  |
| `PRODUCTION_KUBECONFIG`             | Production     | Kubeconfig for Production Kubernetes Cluster               |
| `STAGING_PRODUCT_DATABASE_URL`      | Staging        | PostgreSQL connection string for staging `product_db`      |
| `STAGING_INVENTORY_DATABASE_URL`    | Staging        | PostgreSQL connection string for staging `inventory_db`    |
| `STAGING_CATALOG_DATABASE_URL`      | Staging        | PostgreSQL connection string for staging `catalog_db`      |
| `STAGING_SHIPPING_DATABASE_URL`     | Staging        | PostgreSQL connection string for staging `shipping_db`     |
| `STAGING_USER_DATABASE_URL`         | Staging        | PostgreSQL connection string for staging `user_db`         |
| `STAGING_MEDIA_DATABASE_URL`        | Staging        | PostgreSQL connection string for staging `media_db`        |
| `PRODUCTION_PRODUCT_DATABASE_URL`   | Production     | PostgreSQL connection string for production `product_db`   |
| `PRODUCTION_INVENTORY_DATABASE_URL` | Production     | PostgreSQL connection string for production `inventory_db` |
| `PRODUCTION_CATALOG_DATABASE_URL`   | Production     | PostgreSQL connection string for production `catalog_db`   |
| `PRODUCTION_SHIPPING_DATABASE_URL`  | Production     | PostgreSQL connection string for production `shipping_db`  |
| `PRODUCTION_USER_DATABASE_URL`      | Production     | PostgreSQL connection string for production `user_db`      |
| `PRODUCTION_MEDIA_DATABASE_URL`     | Production     | PostgreSQL connection string for production `media_db`     |

---

## 5. Database Migration & Deployment Safety

### 5.1 Backward-Compatible Migration Policy

- **Expand / Contract Pattern**: Database migrations executed in CI/CD must be backward-compatible with the currently running application code.
- **Never Drop Columns Directly**: When deprecating fields, first deploy code that stops writing to them, then deploy code that stops reading them, and finally drop them in a separate release.
- **Non-Destructive Execution**: Production and staging deployments run `prisma migrate deploy` (never `prisma migrate dev` or `prisma db push`) and `drizzle-orm` migrations.

### 5.2 Standalone Migration Workflow (`migrate.yml`)

For ad-hoc migration execution or maintenance windows:

```bash
gh workflow run migrate.yml -f environment=staging -f action=status
gh workflow run migrate.yml -f environment=staging -f action=deploy
```

---

## 6. Disaster Recovery & Rollback Runbook

### Automatic Rollback

If a deployment fails during the 5-minute rollout stabilization window or if post-deployment health checks fail, the pipeline immediately runs:

```bash
kubectl rollout undo deployment/<service> -n larekmart
```

### Manual Rollback Procedure

If an issue is detected after pipeline completion:

1. Inspect deployment history:
   ```bash
   kubectl rollout history deployment/product-service -n larekmart
   ```
2. Revert to the previous known-healthy revision:
   ```bash
   kubectl rollout undo deployment/product-service -n larekmart
   ```
3. Verify pod health and readiness:
   ```bash
   kubectl get pods -n larekmart -l app.kubernetes.io/name=product-service
   ```
