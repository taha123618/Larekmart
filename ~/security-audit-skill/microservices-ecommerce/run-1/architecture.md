# Architecture summary — microservices-ecommerce (Larekmart)

**Product.** Microservices e-commerce platform for clothing: two Next.js 15 frontends (client storefront :3002, admin dashboard :3003), 12 backend services (Express/Fastify/Hono/Koa Node, one Go service), shared packages, Kafka as the only inter-service channel. Operators are admins; customers are Clerk-authenticated users; guests use self-issued cart tokens.

**Comparable baseline.** Standard SaaS e-commerce reference architecture (storefront + admin + event bus). Baseline accepts dev-first convenience defaults; this repo follows that pattern (compose stacks, PLAINTEXT Kafka, localhost binds), which calibrates but does not dismiss findings evaluated against a production deployment of the same source.

**Stack & build.** pnpm 9 + Turborepo, TypeScript strict, Prisma (Postgres) / Mongoose (MongoDB), kafkajs, ioredis, Clerk auth everywhere, Stripe payments. Offline verification available: `pnpm --filter <ws> check-types`, `pnpm test` (mock-based suites: order, shipping, cart). No general test runner. Docker compose for local infra.

**Entry surfaces.**

- HTTP APIs per service (ports 8000–8012): product, order, payment (Stripe webhooks), auth (Clerk admin proxy), email (none), analytic, notification (Go, WebSocket), search (OpenSearch), inventory, recommendation (FastAPI), cart, catalog, shipping (carrier webhooks), user.
- Next.js apps: SSR pages + API routes (`/api/claim-admin` in admin).
- Kafka topics (~70 in `packages/kafka/src/init-topics.ts`) consumed by 11 Node services + Go consumer manager.
- No file uploads, no dynamic code evaluation, no raw SQL string building (Prisma parameterization).

**Trust boundaries and strongest source-visible controls.**

1. Internet → storefront/admin (Clerk middleware; admin gated on `sessionClaims.metadata.role === "admin"` in `apps/admin/src/middleware.ts`).
2. Browser → backend APIs (`shouldBeUser`/`shouldBeAdmin` middleware derived from verified Clerk sessions in every service).
3. External carriers → shipping webhook (HMAC-style compare; **fail-open in dev/test observed**).
4. Stripe → payment-service (`stripe.webhooks.constructEvent` on raw body — correct).
5. Kafka producers → consumers (no broker auth; envelope `{value: payload}`; handlers parse untrusted JSON defensively).
6. Identity binding: cart uses Clerk-or-guest-token; user-service scopes `/me/*` through `user.id` lookups; inventory reservations release/expire scoped by `userId`.

**Starting paths.** `apps/*/src/middleware/*`, `apps/*/src/routes/*`, `apps/*/src/consumers/*`, `apps/payment-service/src/routes/webhooks.route.ts`, `apps/shipping-service/src/services/webhook.service.ts`, `apps/admin/src/app/api/claim-admin/route.ts`, `packages/kafka/src/*`, compose files.

**Prior coverage.** None — first audit run, no prior ledgers.

**Companion selection.** WEB-PROTOCOL-AND-AUTH for HTTP identity/webhook boundaries; PROTOCOLS-RPC-AND-MESSAGING for Kafka envelope/handler trust; CLOUD-AND-DEPLOYMENT for compose/K8s exposure; DATA-ISOLATION-AND-LIFECYCLE for cart/user/inventory ownership; RESOURCE-EXHAUSTION for unbounded queries and consumer loops (search-service has rate limiting; other services do not — noted as hardening, no source-visible unauthenticated amplification beyond public reads).
