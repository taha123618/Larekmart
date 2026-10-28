---
name: feature-lifecycle
description: 360° Feature Delivery Standard and vertical implementation playbook across Larekmart monorepo. Use whenever building, expanding, or reviewing a feature touching backend, gateway, client, admin, events, tests, and security.
---

# 360° Feature Delivery Standard & Lifecycle Playbook

This skill defines the mandatory 8-stage vertical execution playbook for any feature or microservice in Larekmart (exemplified by `review-service` and `return-service`). No feature may be considered complete if any stage is skipped.

---

## The 8 Mandatory Stages

```
[1. Contracts & Types] -> [2. Backend Service & Outbox] -> [3. API Gateway Routing & Policies]
         ↓
[4. Kafka Event Streams & DLQ] -> [5. Client Storefront UI] -> [6. Admin Operations UI]
         ↓
[7. Automated Unit/Integration Tests] -> [8. Security & Zero-Trust Audit]
```

### Stage 1: Contracts & Types Foundation (`@repo/types`)

- Define TypeScript interfaces and Zod schemas in `packages/types/src/<feature>.ts`.
- Export all contracts in `packages/types/src/index.ts`.
- Define or update the target database schema (Prisma/PostgreSQL or Drizzle).
- Never duplicate type declarations in local apps or packages.

### Stage 2: Backend Microservice Implementation (`apps/<service>`)

- Follow the standard controller-service-repository layered architecture.
- Enforce **Transactional Outbox** (`OutboxEvent`) for all mutations that produce asynchronous domain events to eliminate dual-write hazards.
- Implement **Distributed Idempotency** (`Idempotency-Key` + Redis atomic lease) for high-impact mutations (`POST /orders`, `/refunds`, etc.).
- Expose `GET /health` and `GET /ready` probes.

### Stage 3: API Gateway Reverse Proxy & Resilience (`apps/api-gateway`)

- Register route prefixes in `public.routes.ts`, `authenticated.routes.ts`, or `admin.routes.ts`.
- Set upstream target URL, timeout, and configure the circuit breaker.
- Apply `SingleFlightGroup` to cacheable, high-read paths to eliminate stampedes.
- Ensure untrusted client headers are stripped before forwarding verified identity headers (`x-user-id`, `x-user-role`).

### Stage 4: Kafka Event Streams & Poison-Pill Resilience (`@repo/kafka`)

- Producers must use the `{ value: payload }` envelope and produce via transactional outbox.
- Consumers must read `message.value` and route unparseable/invalid payloads to `<topic>.dlq`.
- Document event schemas in `docs/EVENT-DRIVEN-ARCHITECTURE.md`.

### Stage 5: Customer Storefront Implementation (`apps/client`)

- Create customer client service in `apps/client/src/services/<feature>.service.ts` connecting via API Gateway.
- Implement responsive, mobile-first pages and interactive components adhering to Larekmart design system (dark/light, glassmorphism, micro-animations).
- Maintain React 19 / Next.js 16 hydration safety (avoid Framer Motion on static SSR grids, guard localStorage stores with `isMounted`).

### Stage 6: Admin Operations UI (`apps/admin`)

- Create admin service in `apps/admin/src/services/<feature>.service.ts`.
- Implement responsive dashboard with KPI metrics, searchable/filterable data tables, action modals (approve, reject, inspect, retry), and React Query invalidation.
- Enforce Clerk admin authorization.

### Stage 7: Automated Unit & Integration Testing

- Add standalone tsx test suites under `apps/<service>/tests/` or `packages/<pkg>/tests/`.
- Verify happy path, validation rejections, duplicate request handling, and error scenarios.
- Run `pnpm test` (verify all 26+ suites pass).

### Stage 8: Security & Zero-Trust Hardening

- **Zero-Trust Identity**: Derive user identity exclusively from verified Clerk tokens; reject client-supplied IDs.
- **IDOR Protection**: Explicitly verify resource ownership before reading or mutating records.
- **Constant-Time Verification**: Microservice internal endpoints must verify `x-internal-secret` in constant time.
- **Input Sanitization**: Validate media URLs against trusted S3/MinIO hosts and sanitize freeform text.
- **Verification Gates**: Pass `pnpm check-types`, `pnpm test`, and `pnpm build`.
