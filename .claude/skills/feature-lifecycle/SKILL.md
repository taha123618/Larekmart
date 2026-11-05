---
name: feature-lifecycle
description: 360° Feature Delivery Standard and vertical implementation playbook across Larekmart monorepo. Use whenever building, expanding, or reviewing a feature touching backend, gateway, client, admin, events, tests, and security.
---

# 360° Feature Delivery Standard & Lifecycle Playbook

This skill defines the **Mandatory 6-Pillar Feature Service Delivery Standard** for building, expanding, or integrating any feature service in Larekmart (exemplified by `support-service`, `fraud-service`, `payout-service`, `commission-service`, `return-service`, and `review-service`).

No feature service may be considered complete or merged if any of the 6 pillars is skipped.

---

## The 6 Mandatory Pillars of Feature Service Delivery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              Larekmart 6-Pillar Feature Service Delivery Standard            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Pillar 1: Front-End UI Delivery (apps/admin/*, apps/client/*)             │
│  Pillar 2: Monorepo Microservices & Gateway Integration (apps/* all)        │
│  Pillar 3: Documentation, Skills, Manifests & Config (*.md, skills, *.yml)  │
│  Pillar 4: Deep Analysis, Unit Testing & Integration Testing (100% Pass)   │
│  Pillar 5: Security Audit & Zero-Trust Hardening (OWASP API Top 10)         │
│  Pillar 6: Root Architecture & README.md Synchronization                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Pillar 1: Front-End Delivery (`apps/admin/*`, `apps/client/*`)

Whenever a feature service is added or expanded, both presentation layers must be fully implemented:

1. **Customer Storefront (`apps/client`)**:
   - Create typed API client service in `apps/client/src/services/<feature>.service.ts` routing through API Gateway.
   - Deliver responsive, mobile-first customer pages (e.g. `/support`, `/account/support`, `/account/seller/*`).
   - Implement interactive modals, status cards, and action flows adhering to the Larekmart design system (dark/light theme, Tailwind CSS v4, Zustand/React Query state).
   - Ensure React 19 / Next.js 16 hydration safety (avoid Framer Motion on static SSR grids, guard client stores with `isMounted`).
2. **Admin Operations Dashboard (`apps/admin`)**:
   - Create typed admin service in `apps/admin/src/services/<feature>.service.ts`.
   - Implement operations dashboards with real-time KPI metrics, searchable/filterable data tables, status transition dialogs, and React Query cache invalidation.
   - Enforce Clerk admin authorization (`sessionClaims.metadata.role === 'admin'`).
   - Register sidebar navigation links in `apps/admin/src/components/AppSidebar.tsx`.

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
