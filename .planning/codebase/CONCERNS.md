---
last_mapped_commit: 056473daac295e995dc34f9bdb56d4d180211c77
last_mapped_at: 2026-10-02
---

# Codebase Concerns

**Analysis Date:** 2026-10-02

## Tech Debt

**Prisma Client Generation Dependency:**

- Issue: TypeScript typechecking across workspaces (`pnpm check-types`) depends on Prisma clients being pre-generated (`packages/product-db/generated/prisma`).
- Files: `packages/product-db/prisma/schema.prisma`, `packages/inventory-db/prisma/schema.prisma`
- Impact: Fresh checkouts require running `pnpm db:generate` before `pnpm check-types` can succeed cleanly without cache.
- Fix approach: Keep `pnpm setup` as standard onboarding command, which runs generation and verification in sequence.

**Polyglot Framework Diversity:**

- Issue: Backend Node.js services utilize four different HTTP frameworks: Express 5 (`product-service`, `auth-service`, `analytic-service`, `cart-service`), Fastify 5 (`order-service`, `search-service`, `catalog-service`, `user-service`), Hono 4 (`payment-service`, `inventory-service`, `media-service`), and Koa (`shipping-service`).
- Files: `apps/*/src/index.ts`
- Impact: Increased context switching across service teams; middleware conventions differ between Express, Fastify, and Hono.
- Fix approach: Maintain existing implementations while standardizing any new service creation on Fastify or Hono.

## Known Bugs & Edge Cases

**Kafka Local Initial Topic Creation Race:**

- Symptoms: When starting local development infrastructure from scratch, services may attempt to subscribe to Kafka topics before the broker has finished KRaft leader election.
- Files: `docker-compose.yml`, `packages/kafka/src/consumer.ts`
- Trigger: Running `docker compose up -d` without running `pnpm kafka:init-topics`.
- Workaround: Included `pnpm kafka:init-topics` in `pnpm setup` and configured consumer connection retry backoff in `@repo/kafka`.

## Security Considerations

**API Route Authentication Enforcement:**

- Risk: Client or external actor bypassing auth on unprotected routes.
- Files: `apps/*/src/middleware/auth.ts`
- Current mitigation: Route guards `shouldBeUser` and `shouldBeAdmin` verify Clerk JWT claims. Admin operations require `sessionClaims.metadata.role === "admin"`.
- Recommendations: Maintain strict ingress network policies (`infrastructure/kubernetes/base/network-policies/`) to prevent direct pod exposure.

**Stripe Webhook Signature Verification:**

- Risk: Forged payment notifications triggering unauthorized order fulfillment.
- Files: `apps/payment-service/src/index.ts`
- Current mitigation: Stripe webhook endpoint verifies cryptographic signature with `stripe.webhooks.constructEvent` using `STRIPE_WEBHOOK_SECRET` before processing.

## Performance Bottlenecks

**Catalog Search Query Fan-Out:**

- Problem: Storefront search and category browsing during marketing campaigns can create traffic spikes.
- Files: `apps/catalog-service/src/index.ts`, `apps/search-service/src/index.ts`
- Cause: Complex multi-facet aggregations and fuzzy full-text matches in OpenSearch.
- Improvement path: Implemented multi-tier caching in Redis (`@repo/redis`) with 300s TTL and stale-while-revalidate pattern; configured Kubernetes HorizontalPodAutoscalers (`client-hpa`, `catalog-service-hpa`, `search-service-hpa`) to scale up to 10 replicas.

## Fragile Areas

**Guest Cart to Authenticated User Cart Merge:**

- Files: `apps/cart-service/src/index.ts`, `packages/cart-db/src/models/cart.ts`
- Why fragile: Merging a guest cart (identified by `x-guest-id`) into an authenticated Clerk user account requires atomic item deduplication, quantity capping, and concurrent session reconciliation.
- Safe modification: Write unit tests covering simultaneous guest and user items before altering cart controllers.
- Test coverage: Covered in `apps/cart-service/tests/index.test.ts`.

## Scaling Limits

**Kafka Consumer Lag during Flash Sales:**

- Current capacity: Single-partition default for local dev broker.
- Limit: Consumers for `email-service` and `notification-service` process sequentially per partition.
- Scaling path: Partition high-volume topics (`order.created`, `payment.succeeded`) across 3–8 partitions in production; implemented KEDA `ScaledObject` in `infrastructure/kubernetes/base/autoscaling/keda-scaledobjects.yaml` to scale worker pods dynamically based on topic lag.

## Dependencies at Risk

**Pinned Alpine & Upstream Image CVE Tracking:**

- Risk: Base image packages (`busybox`, `libpq`) experience periodic security vulnerability advisories.
- Impact: Security gate failures in CI if high-severity CVEs are introduced.
- Migration plan: Pinned to stable releases (`node:20-alpine`, `alpine:3.20`), parameterized for Docker Hardened Images (`dhi.io/*`), and tracked with weekly automated Docker Scout scans (`pnpm docker:scout`) and OpenVEX exemptions (`security/vex/larekmart-openvex.json`).

## Missing Critical Features

**None blocking current operations:**

- Infrastructure is fully containerized, observed via Prometheus/Grafana, secured with non-root Docker builds and network policies, and verified with strict TypeScript type-checking.

## Test Coverage Gaps

**End-to-End Synthetic Load Testing:**

- What's not tested: Sustained 10,000+ RPS stress tests across all 15 microservices simultaneously.
- Files: Entire cluster
- Risk: Unforeseen connection pool exhaustion under extreme concurrency.
- Priority: Medium (can be addressed via k6 / Locust load testing suite).

---

_Concerns audit: 2026-10-02_
