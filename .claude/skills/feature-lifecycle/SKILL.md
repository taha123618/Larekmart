---
name: feature-lifecycle
description: 360° Feature Delivery Standard and vertical implementation playbook across Larekmart monorepo. Use whenever building, expanding, or reviewing a feature touching backend, gateway, client, admin, events, tests, and security.
---

# 360° Feature Delivery Standard & Lifecycle Playbook

This skill defines the **Mandatory 6-Pillar Feature Service Delivery Standard** for building, expanding, or integrating any feature service in Larekmart (exemplified by `chat-service`, `support-service`, `fraud-service`, `payout-service`, `commission-service`, `return-service`, and `review-service`).

No feature service may be considered complete or merged if any of the 6 pillars is skipped.

---

## The 6 Mandatory Pillars of Feature Service Delivery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              Larekmart 6-Pillar Feature Service Delivery Standard            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Pillar 1: Front-End UI Delivery (apps/admin/*, apps/client/*, apps/seller/*)  │
│  Pillar 2: Monorepo Microservices & Gateway Integration (apps/* all)        │
│  Pillar 3: Documentation, Skills, Manifests & Config (*.md, skills, *.yml)  │
│  Pillar 4: Deep Analysis, Unit Testing & Integration Testing (100% Pass)   │
│  Pillar 5: Security Audit & Zero-Trust Hardening (OWASP API Top 10)         │
│  Pillar 6: Root Architecture & README.md Synchronization                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Pillar 1: Front-End Delivery (`apps/admin/*`, `apps/client/*`, `apps/seller/*`)

Whenever a feature service is added or expanded, all relevant presentation layers must be fully implemented:

1. **Customer Storefront (`apps/client`)**:
   - Create typed API client service in `apps/client/src/services/<feature>.service.ts` routing through API Gateway.
   - Deliver responsive, mobile-first customer pages (e.g. `/support`, `/account/support`, `/account/seller/*`).
   - Implement interactive modals, status cards, and action flows adhering to the Larekmart design system (dark/light theme, Tailwind CSS v4, Zustand/React Query state).
   - Ensure React 19 / Next.js 16 hydration safety (avoid Framer Motion on static SSR grids, guard client stores with `isMounted`).
2. **Admin Operations Dashboard (`apps/admin`)**:
   - Create typed admin service in `apps/admin/src/services/<feature>.service.ts` routing through API Gateway via `getApiGatewayUrl()`.
   - Implement operations dashboards with real-time KPI metrics, searchable/filterable TanStack Table v9 views, status transition dialogs/sheets, and React Query cache invalidation.
   - Standardize `<Breadcrumb>` wayfinding and responsive header toolbars (`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`) on every dashboard route.
   - Enforce viewport boundaries (`min-w-0 max-w-full w-full`) and horizontal table scroll containers (`overflow-x-auto min-w-full` with explicit `min-w-[...]` column headers) preventing viewport blowout on mobile screens.
   - Implement App Router lifecycle boundaries (`error.tsx` retry boundary, `loading.tsx` skeleton placeholder, `not-found.tsx`).
   - Enforce Clerk admin authorization (`sessionClaims.metadata.role === 'admin'`).
   - Register sidebar navigation links in `apps/admin/src/components/AppSidebar.tsx`.
3. **Seller & Merchant Dashboard (`apps/seller`)**:
   - For merchant-facing features (catalog, inventory, orders, fulfillment, payouts, support, chat, policies, storefront settings), deliver Nuxt 3 pages under `apps/seller/app/pages/`.
   - Wire Pinia stores (`seller.store.ts`, `auth.store.ts`) and TanStack Vue Query composables (`useProducts`, `useOrders`, `useSupport`, etc.).
   - Follow the Nuxt UI 3 / Tailwind CSS v4 design system with dark/light mode and mobile-first responsive layouts.

---

### Pillar 2: Cross-Service & Gateway Integration (`apps/*` all services and others)

Every feature service must integrate seamlessly across the monorepo ecosystem:

1. **API Gateway Reverse Proxy (`apps/api-gateway`)**:
   - Register routes in `public.routes.ts`, `authenticated.routes.ts`, or `admin.routes.ts`.
   - Configure upstream service registry, circuit breaker (`Opossum`), timeout limits, and rate-limiting rules.
   - Apply `SingleFlightGroup` on high-velocity read aggregation routes to prevent backend thundering herds.
   - **Perimeter Header Sanitization**: Unconditionally strip client-supplied `x-user-id`, `x-user-role`, `x-internal-secret`, and `x-session-claims` headers before injecting verified claims.
2. **Asynchronous Kafka Pipelines (`@repo/kafka`)**:
   - Establish Kafka topics with the `{ value: payload }` envelope and poison-pill isolation (`<topic>.dlq`).
   - Enforce **Transactional Outbox** (`OutboxEvent`) for all mutations that produce asynchronous domain events to eliminate dual-write hazards.
   - Use `kafkaConsumer.subscribeBatch()` for high-throughput stream ingestion.
   - Wire cross-service consumer handlers in dependent microservices (e.g., `notification-service`, `analytic-service`, `order-service`, `return-service`).
3. **Zero Synchronous HTTP Calls Between Services**:
   - Backend services communicate strictly through Kafka events or shared database contracts; never introduce direct HTTP calls between backend microservices.

---

### Pillar 3: Documentation, Skills, Manifests & Configuration Updates (`*.md`, skills, `*.yml`)

1. **Architecture & Contract Documents**:
   - Update `docs/API.md` with complete endpoint specifications, request/response schemas, and error codes.
   - Update `docs/ARCHITECTURE.md` and `docs/DEPENDENCIES.md` with the new service boundaries and data flows.
   - Update `docs/EVENT-DRIVEN-ARCHITECTURE.md` with all new Kafka topics, payload schemas, and consumers.
   - Create authoritative implementation plans in `docs/plans/<feature>-service-architecture.md` and `docs/plans/<feature>-service-implementation-plan.md`, indexing them in `docs/plans/README.md`.
2. **Deployment & Orchestration Manifests (`*.yml`)**:
   - **Docker Compose**: Add service definition to `docker-compose.yml` with port mapping, environment variables, healthchecks, and resource limits (`deploy.resources`). Add Traefik reverse-proxy labels in `docker-compose.traefik.yml` if exposed.
   - **Kubernetes**: Add declarative Kustomize deployment manifests in `infrastructure/kubernetes/base/services/<feature>.yaml`, registering the service in `base/kustomization.yaml`, configmaps, and network policies.
   - **Observability**: Add Prometheus scrape target in `infrastructure/observability/prometheus/prometheus.yml`.
   - **CI/CD**: Update GitHub Actions workflows (`.github/workflows/production.yml`, `staging.yml`, `migrate.yml`, and `reusable-docker-build.yml`).
3. **Agent Skills & Rules**:
   - Update repository maps and guidelines across all skill folders (`.agents/skills/*`, `.claude/skills/*`, `.cursor/skills/*`, `.gemini/skills/*`, `.github/skills/*`).

---

### Pillar 4: Deep Project Analysis & Comprehensive Testing (Unit & Integration)

1. **Pre- & Post-Implementation Deep Analysis**:
   - Analyze upstream dependencies, database schemas, foreign key relationships, and blast radius before making code edits.
   - Verify post-implementation architectural integrity, boundary isolation, and error-handling resilience.
2. **Unit & Integration Test Suites**:
   - Write comprehensive unit tests for controllers, services, guards, and business logic (e.g., SLA computations, commission mathematics, idempotency leases).
   - Write integration tests verifying real database queries, status transitions, role-based redactions, and error responses.
   - Implement concurrency tests verifying Redis atomic locking and duplicate mutation prevention.
3. **Quality Gates**:
   - Maintain a 100% test pass rate (`pnpm test`).
   - Enforce 0 TypeScript compile errors monorepo-wide (`pnpm check-types`).
   - Pass linting on modified frontend applications (`pnpm lint`).

---

### Pillar 5: Security Audit & Zero-Trust Hardening

1. **OWASP API Top 10 Mitigation**:
   - **BOLA / IDOR Protection**: Explicitly verify resource ownership against verified session identity before reading or updating entities.
   - **Constant-Time Secret Comparison (SEC-16)**: Internal service endpoints must verify `x-internal-secret` using constant-time timing-safe comparisons (`crypto.timingSafeEqual`) with SHA-256 pre-hashed buffers.
   - **Admin Privilege Decoupling (SEC-15)**: Gateway transport secret verification must never automatically elevate proxied regular users to admin status. User roles must originate strictly from verified Clerk token metadata.
   - **Data Privacy & Redaction**: Confidential internal notes (`isInternalNote: true`), merchant secrets, or PII must be systematically redacted from customer and seller query responses.
   - **Fail-Closed Semantics**: Unauthenticated requests or cryptographic verification errors must fail closed with 401 Unauthorized / 403 Forbidden.
2. **Distributed Idempotency**:
   - State-mutating routes must enforce `Idempotency-Key` headers using `@repo/redis` atomic leases (`SET NX PX`) to reject concurrent duplicate mutations and transparently replay cached responses.

---

### Pillar 6: Global README.md & Root Architecture Sync

1. **Root Documentation Synchronization**:
   - Update root `README.md` to document the new feature service, including runtime, assigned port, database engine, Kafka topics, and primary responsibilities.
   - Update the system topology ASCII/mermaid diagrams in `README.md` and `docs/ARCHITECTURE.md`.
   - Keep the monorepo workspace inventory table in `README.md` and `AGENTS.md` fully up to date.
   - Verify that all referenced markdown links and port numbers are accurate.

---

## Mandatory Engineering Roles & Feature Quality Gates

Whenever introducing or refactoring any feature in the monorepo, the implementation must pass the following five senior engineering evaluation gates:

### 1. Senior DevOps Engineer & Cloud Infrastructure Architect Gate

- [ ] **Containerization**: Multi-stage Dockerfile using `turbo prune`, minimal non-root base (`USER node` / UID 1000), `.dockerignore` properly configured, graceful shutdown on `SIGTERM`.
- [ ] **Kubernetes Manifests**: Kustomize deployment manifest in `infrastructure/kubernetes/base/services/<feature>.yaml`, explicit CPU/memory `requests` and `limits`, `livenessProbe`, `readinessProbe`, and `startupProbe` configured.
- [ ] **Resilience & Scaling**: Pod Disruption Budget (`PDB`) defined (`maxUnavailable: 1`), Horizontal Pod Autoscaler (`HPA`) configured, and KEDA `ScaledObject` defined if consuming from Kafka.
- [ ] **Observability**: Prometheus `/metrics` endpoint exposed and registered in `prometheus.yml`. Standard operational metrics tracked (requests, latency, error rate, queue lag). Grafana dashboard configured and Alertmanager alert rules defined with actionable runbooks.
- [ ] **Centralized Logging & Tracing**: Structured JSON logs with `x-request-id` correlation. Zero sensitive data (tokens, passwords, keys) in logs. W3C `traceparent` context propagated for distributed tracing.
- [ ] **CI/CD & Deployments**: Automated GitHub Actions workflow checks pass; immutable image tags used; rollback procedures verified; database migrations are non-destructive and backward-compatible.

### 2. Senior SQA Engineer Gate

- [ ] **15-Pillar Coverage**: Feature tested across unit, integration, API contract, Playwright E2E browser flows, frontend components, database transactions, auth/RBAC, validation, security/DAST, performance/k6, edge cases, regression, responsive UI, WebSockets, and background workers.
- [ ] **Deterministic Test Architecture**: Independent test fixtures, zero shared mutable state, reliable cleanup, no flaky timeouts or unhandled promise rejections.
- [ ] **Negative & Edge-Case Validation**: Explicitly test malformed inputs, oversized payloads, invalid JSON, negative numbers, empty strings, null bytes, and unauthorized role attempts.
- [ ] **Quality Gates**:
  - `pnpm test` passes 100% monorepo-wide.
  - `pnpm test:dast` passes all OWASP API Security Top 10 categories.
  - `pnpm check-types` reports 0 TypeScript compiler errors.
  - `pnpm format:check` and `pnpm lint` pass cleanly.
- [ ] **Defect Classification**: Any discovered bugs are documented with severity (Critical, High, Medium, Low), reproduction steps, root cause, and regression tests.

### 3. Senior Cybersecurity Engineer Gate

- [ ] **Perimeter Zero-Trust**: Ingress headers (`x-user-id`, `x-user-role`, `x-internal-secret`) stripped unconditionally at API Gateway. Downstream claims injected solely from verified cryptographic tokens.
- [ ] **Cryptographic Verification**: Direct Bearer tokens verified via RS256 (`CLERK_JWT_KEY`) with clock skew validation (`exp`, `nbf`). Internal shared secrets verified using constant-time timing-safe comparison (`crypto.timingSafeEqual`) with SHA-256 pre-hashed buffers.
- [ ] **SQL Injection Prevention**: 100% parameterized queries or Prisma/Mongoose ORM models. Zero unparameterized SQL interpolations.
- [ ] **Strict File Upload Security**: Direct presigned S3/MinIO upload flow; magic-byte file signature validation (`file-type`); category-based size limits; random UUID server filenames; storage outside executable paths; quarantine workflow for untrusted files.
- [ ] **BOLA/IDOR Defense**: All mutating and read endpoints strictly verify resource ownership against authenticated `userId` / `sellerId`. Internal gateway secrets never grant administrative privileges to users.
- [ ] **Abuse & Rate Limiting**: Distributed Redis sliding-window rate limiting on all public, authentication, and state-mutating endpoints. Rate-limit keys derive from verified identity or trusted client IP.
- [ ] **Secrets & Privacy**: Zero hardcoded secrets in code or git. Confidential internal notes and PII strictly redacted from non-admin API responses.

### 4. Senior MLOps Engineer Gate (for AI/ML Services)

- [ ] **MLOps Module Structure**: `app/mlops/{validator.py, drift_detector.py, registry.py, tuner.py}` present; full details in `.agents/skills/mlops-standards/SKILL.md`.
- [ ] **Data & Quality Gates**: Training dataset finiteness/bounds validated; minimum model quality gate enforced (e.g., `separation_margin >= 0.02`, `NDCG@10 >= 0.30`).
- [ ] **Drift & Telemetry**: Online PSI feature drift tracking exposed at `GET /api/v1/<service>/mlops/status` and exported to Prometheus (`ml_feature_drift_psi`).
- [ ] **Reproducibility & Registry**: Hyperparameters declared in `params.yaml`; model artifacts versioned in MLflow / MinIO with SHA-256 `.manifest.json`.
- [ ] **Continuous Training (CT)**: Kubernetes `CronJob` in `retraining-cronjobs.yaml` and CI step in `.github/workflows/mlops-ct-pipeline.yml`. `pnpm audit:mlops` passes 100%.

### 5. Senior DevSecOps Engineer Gate

- [ ] **Container & K8s Hardening**: Non-root containers (`USER 1001`), `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, `automountServiceAccountToken: false`, `NetworkPolicy`, and `PodDisruptionBudget`; full details in `.agents/skills/devsecops-standards/SKILL.md`.
- [ ] **IaC & Image Security Scans**: `trivy config --exit-code 1` and `trivy image --exit-code 1 --severity CRITICAL` pass with 0 findings.
- [ ] **CI/CD & Secrets**: Third-party GitHub Actions pinned to full commit SHA; minimal `permissions:` blocks; TruffleHog secret scanning; Vault/ESO secrets management.
- [ ] **DAST Verification**: All 8 OWASP API Security Top 10 phases pass via `pnpm test:dast`.
