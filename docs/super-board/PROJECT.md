# Larekmart — Project Overview

## 1. What Larekmart Is

**Larekmart** is a production-grade multi-tenant e-commerce marketplace platform (architected after systems like Amazon, Daraz, AliExpress, and Alibaba). It is organized as a **pnpm + Turborepo monorepo** containing:

- **2 Frontends**:
  - `apps/client` (:3002): High-performance customer storefront (Next.js 16, React 19, Tailwind CSS v4, GSAP, Framer Motion, Lenis).
  - `apps/admin` (:3003): Administrator dashboard (Next.js 15, React 19, shadcn/ui, TanStack Query & Table, Recharts).
- **1 Centralized API Gateway**:
  - `apps/api-gateway` (:8080 / :8090): Fastify 5 reverse proxy, Clerk JWT validation, Redis distributed sliding-window rate limiting, in-flight concurrency bulkheads, and thundering-herd mitigation (`SingleFlightGroup`).
- **22 Microservices + 1 Headless Worker**:
  - `product-service` (:8000), `order-service` (:8001), `payment-service` (:8002), `auth-service` (:8003), `analytic-service` (:8004, Go), `notification-service` (:8005, Go), `search-service` (:8006), `inventory-service` (:8007), `recommendation-service` (:8008, Python), `cart-service` (:8009), `catalog-service` (:8010), `shipping-service` (:8011), `user-service` (:8012), `media-service` (:8013), `review-service` (:8014), `wishlist-service` (:8015), `promotion-service` (:8016), `tax-service` (:8017), `return-service` (:8018), `pricing-service` (:8019), `vendor-service` (:8020), `seller-service` (:8021), `email-service` (Kafka worker).
- **11 Shared Packages**:
  - `@repo/kafka`, `@repo/types`, `@repo/monitoring`, `@repo/redis`, `@repo/opensearch`, `@repo/product-db`, `@repo/order-db`, `@repo/cart-db`, `@repo/inventory-db`, `@repo/catalog-db`, `@repo/shipping-db`, `@repo/user-db`, `@repo/vendor-db`.

---

## 2. Core Operational & Development Rules

1. **Instruction Source of Truth**:
   - `AGENTS.md` is the canonical root rule file. All sub-agents and worker pipelines read `AGENTS.md`.
2. **Asynchronous Cross-Service Integration**:
   - Microservices communicate strictly via Apache Kafka events with the `{ value: payload }` envelope convention. There are zero direct service-to-service HTTP dependencies.
3. **Branch Topology & Workflows**:
   - `base_branch`: `staging`
   - Production target: `main`
   - Feature/bug branches are cut from `staging` and merged back via pull requests.
4. **Verification & Quality Gates**:
   - `pnpm check-types` across all 39 packages (0 errors).
   - `pnpm test` (all 27 test suites).
   - `pnpm build` (production Next.js and services compilation).
   - `pnpm format:check` (Prettier code style).
