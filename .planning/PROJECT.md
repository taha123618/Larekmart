# Larekmart E-Commerce Platform

## What This Is

**Larekmart** is a production-grade microservices e-commerce platform for market place like: amazon,daraz,ALiexpress,ALibaba and other , built within a pnpm + Turborepo monorepo. It features two Next.js 15 frontends (a customer-facing retail storefront and an operations admin portal), 15 polyglot backend microservices (Node.js, Go, Python), and 11 shared packages.

## Core Value

Reliable, zero-downtime product discovery and checkout powered by strictly asynchronous event-driven microservices with zero service-to-service HTTP coupling.

## Business Context

- **Customer**: Online shoppers browsing and purchasing products from the marketplace.
- **Revenue model**: Direct-to-consumer and marketplace sales processed securely through Stripe Checkout.
- **Success metric**: High transaction throughput, sub-second product search latency, and zero checkout dropped events.
- **Strategy notes**: Follows `docs/PRD.md` and `docs/EVENT-DRIVEN-ARCHITECTURE.md`.

## Requirements

### Validated

- [x] **INFRA-01**: Multi-stage hardened Docker containerization with non-root execution across all 15 services and frontends.
- [x] **INFRA-02**: Kubernetes Kustomize base and overlays (`development`, `staging`, `production`) with NGINX Ingress and zero-trust network policies.
- [x] **INFRA-03**: Observability stack incorporating Prometheus, Grafana, Alertmanager, and Loki centralized logging.
- [x] **INFRA-04**: Automated Docker Scout image security scanning and OpenVEX attestation pipeline.
- [x] **INFRA-05**: KEDA event-driven autoscaling for Kafka consumers (`email-service`, `notification-service`).
- [x] **INFRA-06**: External Secrets Operator (ESO) integration for automated secret synchronization.

### Active

- [ ] **REQ-CLI-01**: Customer storefront catalog browsing, category filtering, and product detail variant selection.
- [ ] **REQ-CLI-02**: Client-side persistent shopping cart with variant management and quantity controls.
- [ ] **REQ-CLI-03**: Embedded Stripe Checkout experience and webhook-driven order fulfillment.
- [ ] **REQ-ADM-01**: Admin dashboard operations with live KPI metrics, catalog authoring, and order tracking.
- [ ] **REQ-SRV-01**: Full end-to-end integration tests and load testing across all microservices.

### Out of Scope

- **Direct Service-to-Service HTTP Calls** — Prohibited by ADR-0001; all cross-service integration must remain asynchronous via Kafka.
- **Shared Monolithic Database** — Prohibited by ADR-0002; each microservice owns its dedicated database schema.
- **Custom Password/Auth Storage** — Prohibited by ADR-0003; all user identity and RBAC are handled exclusively by Clerk.

## Context

- **Ecosystem**: pnpm + Turborepo monorepo with strict TypeScript typing across 29 workspaces.
- **Event Bus**: Apache Kafka 3.8 (KRaft mode) using `@repo/kafka` with `{ value: payload }` envelope convention.
- **Data Tier**: Polyglot storage: PostgreSQL 16 (Prisma), MongoDB 7.0 (Mongoose), Redis 7.4 (ioredis), OpenSearch 2.17.
- **Auth**: Clerk JWT Bearer token verification at route middleware boundaries.

## Constraints

- **Architecture**: Asynchronous event-driven only — Kafka topics are the sole inter-service communication mechanism.
- **Security**: Non-root container execution (UID 1000/1001), Clerk JWT verification, Stripe webhook signature verification.
- **Monorepo**: Boundary isolation — packages cannot depend on apps; apps cannot import from other apps.

## Key Decisions

| Decision                       | Rationale                                                                                | Outcome |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ------- |
| Asynchronous Kafka Integration | Prevents cascading failures and distributed transaction deadlocks (ADR-0001)             | ✓ Good  |
| Polyglot Persistence           | Tailors data engine (PostgreSQL vs MongoDB) to specific service domain needs (ADR-0002)  | ✓ Good  |
| Centralized Clerk Auth         | Eliminates security risks and maintenance of custom password/session storage (ADR-0003)  | ✓ Good  |
| Docker Hardened Images (DHI)   | Minimizes CVE attack surface and enforces reproducible zero-remediable-vulnerability SLA | ✓ Good  |

---

_Last updated: 2026-10-02 after /gsd-onboard doc ingest_
