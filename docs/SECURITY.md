# Security Architecture & Policies

Security architecture, authentication standards, perimeter protection, and data security guidelines across Larekmart.

---

## 1. Authentication & Authorization (Clerk & RBAC)

- **Centralized Identity**: Authentication is delegated to **Clerk** across all frontends and downstream services.
- **Session Claims**: User roles are held in `sessionClaims.metadata.role` (`"user" | "admin"`), defined as `CustomJwtSessionClaims` in `@repo/types`.
- **Backend Route Guards**:
  - Express (`product-service`, `auth-service`, `cart-service`): `shouldBeUser` / `shouldBeAdmin` middleware.
  - Fastify (`order-service`, `catalog-service`, `search-service`, `user-service`, `pricing-service`, `tax-service`, `seller-service`, `commission-service`, `review-service`, `wishlist-service`): `preHandler: shouldBeUser | shouldBeAdmin`.
  - Hono (`payment-service`, `inventory-service`, `media-service`, `promotion-service`): middleware checking Clerk session claims or trusted gateway headers.
  - Koa (`shipping-service`, `return-service`): `requireAdminOrInternal` middleware.
  - NestJS Fastify (`vendor-service`, `payout-service`): `AdminOrInternalGuard` and `SellerGuard`.
  - FastAPI / Python (`recommendation-service`, `fraud-service`): dependency injection with `verify_admin_or_internal` and `safe_timing_compare`.
- **Admin UI Gating**: `apps/admin/src/middleware.ts` routes non-admins to `/unauthorized`. Frontend gating provides defense-in-depth; all mutating operations are strictly re-authorized on backend microservices.
- **Admin Self-Promotion Bootstrap**:
  - `POST /api/claim-admin` in `apps/admin` is fail-closed: disabled by default unless `ALLOW_ADMIN_CLAIM === "true"` and `ADMIN_REGISTRATION_SECRET` is set.
  - Requires valid Clerk authentication and timing-safe comparison on the `x-admin-claim-secret` header.
- **Direct Bearer Token Verification**:
  - Services that accept direct Clerk tokens (`shipping-service`, `return-service`, `notification-service` WebSockets, `fraud-service`) verify cryptographic signatures against `CLERK_JWT_KEY` (RS256 PEM public key/certificate) or test fixture `CLERK_JWT_HMAC_KEY` (HS256) and enforce `exp`/`nbf`. Tokens with missing, malformed, or forged signatures fail closed with `401 Unauthorized`.
  - The Clerk secret key is **never** used as an HMAC key. Symmetric verification is strictly limited to an explicit `CLERK_JWT_HMAC_KEY` test fixture.
  - `analytic-service` and `notification-service` use the shared Go RS256 verifier; `recommendation-service` and `fraud-service` reject unverified JWTs and enforce signature validation / gateway headers.
  - Local identity bypasses (`X-User-ID`, `?user_id=`, `X-Dev-Role`, `x-dev-admin-override`) require explicit `ANALYTIC_DEV_AUTH_BYPASS` / `NOTIFICATION_DEV_AUTH_BYPASS` / `RECOMMENDATION_DEV_AUTH_BYPASS` / `FRAUD_DEV_AUTH_BYPASS` flags and are strictly disabled in production.
- **Super Admin Governance & Delegated Administration**:
  - **Super Admin Authority**: Global kill-switch operations (`isSellerEnabled` in `system_settings`) and granting/revoking delegations require full Super Admin authority (`sessionClaims.metadata.role === "admin"`).
  - **Delegated Manage Admin**: Operational marketplace administration (e.g., managing seller storefronts, staff, and policies) can be delegated via `admin_delegations` records in `seller-service` with specific scopes (e.g. `manage_sellers`).
  - **Header-Level Authority Binding**: Downstream services verify either direct Super Admin role or `x-user-can-manage-sellers: true` for delegated seller operations.

---

## 2. Ingress & Perimeter Security (API Gateway)

The centralized API Gateway (`apps/api-gateway`, Fastify 5 on port 8080/8090) serves as the primary ingress perimeter:

- **Client Header Stripping**:
  - Client-supplied internal headers (`x-user-id`, `x-user-role`, `x-seller-id`, `x-internal-secret`, `x-user-is-seller`, `x-user-can-manage-sellers`, `x-dev-admin-override`, `x-dev-role`, `x-force-primary`, `x-read-your-writes`, `x-db-lsn`) are unconditionally stripped on all incoming requests both in initial middleware (`onRequest`) and before proxy forwarding (`rewriteRequestHeaders`).
  - Mitigates user impersonation, seller privilege spoofing, replication header manipulation, and privilege escalation attacks.
- **Trusted Identity Propagation**:
  - The Gateway verifies Clerk session tokens at the perimeter and injects verified `GATEWAY_HEADERS.USER_ID` and `GATEWAY_HEADERS.USER_ROLE` downstream, signed with `GATEWAY_HEADERS.INTERNAL_SECRET`.
  - Propagates verified seller context downstream via `x-user-is-seller` and delegated management capability via `x-user-can-manage-sellers`.
- **Distributed Rate Limiting**:
  - Enforced per authenticated user, bearer token (SHA-256 hash), or trusted client IP via Redis sliding window / token bucket.
  - Keys never use client-supplied `x-user-id` or `X-Forwarded-For` directly. `TRUST_PROXY` parses via `FastifyServerOptions["trustProxy"]` (hop counts, boolean, CIDR) so `X-Forwarded-For` cannot be spoofed to bypass limits.
  - Configured with separate limits for sensitive routes (`auth`, `search`, `orders`, `media`, `general`, and `onboarding` tier at 10 req/min for merchant registration and KYB dossiers — SEC-05).
- **Seller Product Attribution & IDOR Protection (SEC-02)**:
  - Marketplace products in `@repo/product-db` and `product-service` require `sellerId` attribution on creation (`POST /products`).
  - Product mutations (`PUT /products/:id`, `DELETE /products/:id`) verify `product.sellerId === req.userId` (or admin), returning `403 Forbidden` for non-owners.
- **Dynamic PostgreSQL WAL LSN Tracking & Read-Your-Writes**:
  - Mutating database write operations stamp `x-db-lsn` response headers (`pg_current_wal_lsn()`). The API Gateway caches session LSNs in Redis (`markReadYourWritesWithLSN`), enabling read projections to detect replica lag against `pg_last_wal_replay_lsn()` and dynamically fail over to the primary database.
- **Multi-Node Redis Cluster Slot Pinning**:
  - Redis multi-key Lua scripts and commands enforce CRC16 slot hash tagging (`{tenant_id:warehouse_id}`). `@repo/redis` enforces `assertClusterSlotAlignment` to catch missing bracket constraints upfront and eliminate `CROSSSLOT` exceptions.
- **Resilience & Information Disclosure Mitigation**:
  - Opossum circuit breakers isolate failing downstream services.
  - Idempotent GET/HEAD requests support bounded retries with exponential backoff.
  - Upstream errors are normalized; internal stack traces, database strings, and private IPs are stripped from responses.

---

## 3. Inter-Service Trust & Timing Attack Mitigation

- **Asynchronous Decoupling**: Business workflows communicate asynchronously via Apache Kafka (`@repo/kafka`). Direct HTTP calls between microservices are prohibited.
- **Constant-Time Secret Verification**:
  - Services accepting gateway traffic authenticate `x-internal-secret` using constant-time cryptographic comparison (`crypto.timingSafeEqual`) on SHA-256 digests (`safeTimingCompare`).
  - Implemented across every downstream microservice, with Go services using `crypto/subtle.ConstantTimeCompare`.
  - Prevents timing side-channel attacks against `INTERNAL_SERVICE_SECRET`.
- **Secret Is Transport Authentication, Not User Authority**:
  - A valid internal secret proves the request came through the gateway; it must never grant admin rights to a proxied user. `commission-service`, `payout-service`, `fraud-service`, `seller-service`, `vendor-service`, `shipping-service`, and `analytic-service` require an admin/super-admin role for user requests and only allow pure M2M (secret with no user identity) where explicitly designed.
- **Production Secret Validation**:
  - `validateInternalServiceSecret` from `@repo/types` fails startup in production when the secret is missing, shorter than 16 characters, or matches a placeholder (`dev-shared-*`, `change-me`, `replace-me`, `example`, `dummy`, `__required`).
  - `validateClerkSecretKey` fails startup in production when `CLERK_SECRET_KEY` is missing, not prefixed with `sk_`, or matches a known mock/placeholder value.
  - Go `analytic-service` panics at startup in production if `INTERNAL_SERVICE_SECRET` is weak/placeholder.
  - Python microservices (`recommendation-service`, `fraud-service`) enforce Pydantic fail-closed validation on startup (`app_env == "production"`), raising fatal `ValueError` if `INTERNAL_SERVICE_SECRET` is missing, shorter than 16 characters, or matches default/placeholder patterns.

---

## 4. Broken Object-Level Authorization (IDOR Prevention) & BFLA

- **Strict Resource Ownership & Function-Level Authorization**:
  - `order-service` verifies that the accessed order belongs to the requester: `order.userId === request.userId || request.userRole === "admin"`.
  - `user-service` scopes customer operations to `/me` or verified `request.userId`.
  - `cart-service` binds operations to verified `userId` or unguessable cryptographic guest tokens (`x-guest-token`).
  - **Seller Payout BFLA Hardening**: Seller payout routes (`GET /api/v1/sellers/me/payouts`, `/balance`, `/statements`) in the API Gateway mandate `requireSeller: true`. `payout-service` `SellerGuard` strictly requires `x-user-is-seller === "true"` or role `"seller" | "admin"`, rejecting ordinary customer tokens with `403 Forbidden` and preventing horizontal/vertical balance extraction across tenant boundaries.
  - Line-item price verification: COD and Stripe order totals are recomputed server-side from authoritative catalog prices (`getServerProductPricesPaisa`), rejecting client-declared price discrepancies with `409 Conflict`.
- **Double-Entry Financial Ledger Invariants (`payout-service`)**:
  - Balanced append-only double-entry ledger (`ledger_entries`) within ACID transactions ensures `SUM(debit) == SUM(credit)` zero-sum invariant for every financial movement.
  - Authoritative balance computation aggregates immutable ledger entries, eliminating phantom balance drift from mutable columns.
  - Payout retries and provider callbacks enforce idempotency keys and cryptographic reconciliation.

---

## 5. Injection Vulnerability Protections

- **Parameterized Queries Everywhere**:
  - Zero raw SQL concatenations or unescaped template literals across the codebase.
  - Prisma queries in `@repo/product-db`, `@repo/inventory-db`, `@repo/catalog-db`, `@repo/shipping-db`, and `@repo/user-db` use typed client methods. Zero occurrences of `$queryRawUnsafe`.
  - Drizzle ORM queries in `commission-service`, `payout-service`, `seller-service`, `pricing-service`, `promotion-service`, `media-service`, `review-service`, and `wishlist-service` use prepared statements with strict parameter binding.
  - Health check queries strictly use tagged template literals (`prisma.$queryRaw\`SELECT 1\``).
  - PostgreSQL queries in `apps/analytic-service` strictly parameterize inputs (`$1`, `$2`, etc.).
- **NoSQL / Mongoose Security**:
  - MongoDB models in `@repo/order-db` and `@repo/cart-db` use Mongoose schemas.
  - Dynamic ID parameters are validated with `mongoose.Types.ObjectId.isValid` before querying to prevent query-selector injection.

---

## 6. Object Storage & File Upload Security (`media-service`)

- **Presigned Upload Architecture**:
  - Clients upload directly to S3/MinIO using short-lived presigned PUT URLs (`MEDIA_UPLOAD_SESSION_TTL_SECONDS`). Large binary payloads never traverse or buffer on application API nodes.
- **Magic-Byte Content Verification**:
  - File buffers are inspected at completion using signature magic bytes (`MAGIC_BYTES`) for JPEG, PNG, WebP, AVIF, and PDF to prevent MIME-type spoofing or polyglot payload execution.
- **Path Traversal & Filename Sanitization**:
  - `sanitizeFilename` strips directory traversal sequences (`../`, `..\\`), null bytes, and non-printable characters. Storage keys use deterministic UUID paths (`{ownerType}/{ownerId}/{mediaId}.{ext}`).
- **Size Limits & Quarantine**:
  - Size caps are enforced per category (`avatar`, `product-image`, `seller-document`).
  - Malformed or failed uploads transition into `QUARANTINED` status and emit `media.quarantined` events.

---

## 7. Webhook & Integration Cryptography

- **Stripe Webhooks (`payment-service`)**:
  - Validates `stripe-signature` using `stripe.webhooks.constructEvent()` against raw request text and `STRIPE_WEBHOOK_SECRET`.
  - Unsigned or invalid webhooks fail immediately with `400` before emitting fulfillment events to Kafka.
- **Carrier Webhooks (`shipping-service`)**:
  - Inbound carrier webhooks enforce HMAC-SHA256 payload binding via `crypto.timingSafeEqual`.
  - Fails closed if the secret is missing or set to the default placeholder.

---

## 8. Network Security, CORS & Security Headers

- **Strict CORS Origin Allowlists**:
  - Configured across the API Gateway and backend services against explicit frontend origins (`CORS_ORIGIN`, `CLIENT_URL`, `ADMIN_URL`).
  - The shared `resolveCorsOrigins` helper in `@repo/types` centralizes parsing and defaults to localhost frontends; it filters out `*`.
  - Wildcard origins (`origin: "*"` / `origin: true`) are strictly forbidden when `credentials: true` is enabled to prevent origin reflection vulnerabilities.
- **Defensive HTTP Headers**:
  - Fastify, Express, Hono, Koa, and Next.js applications emit standard defensive headers:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `X-XSS-Protection: 1; mode=block`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 9. Secrets & Environment Hygiene

- **Strict Version Control Exclusion**:
  - `.gitignore` comprehensively ignores `.env` and all `.env.*` variants while explicitly preserving tracked `.env.example` templates (`!.env.example`).
  - No real `.env` files, `.pem` certificates, or secrets are tracked in version control.
- **Public vs Private Environment Variables**:
  - Next.js frontends (`apps/client`, `apps/admin`) only expose benign client constants via `NEXT_PUBLIC_*` (public keys, gateway URLs). Private backend credentials (`CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `INTERNAL_SERVICE_SECRET`, database URIs) are never prefixed with `NEXT_PUBLIC_`.
- **Kubernetes External Secrets**:
  - `infrastructure/kubernetes/base/secrets/secret-templates.yaml` is an External Secrets template. Secret values are `__REQUIRED_EXTERNAL_SECRET__` and projected by the external-secrets operator; no working defaults are committed.
- **Production Environment Gates**:
  - Production deployments must set both `NODE_ENV=production` and `APP_ENV=production`; the common ConfigMap does so, and startup validation / dev-bypass gates depend on them.

---

## 10. Container & Supply Chain Security

- **Hardened Image Baseline**: All Docker container workloads adhere to the Docker Hardened Image (DHI) standard with multi-stage builds and non-root execution (UID 1000/1001/10001).
- **Vulnerability Scans**: Docker Scout Quickview (`pnpm docker:scout`) enforces zero Critical and zero High remediable CVEs.

---

## 11. Comprehensive Security Audit Report

For an in-depth, code-level vulnerability analysis, IDOR inspection, and defense-in-depth verification across all 26 microservices and frontends, consult the dedicated [Comprehensive Security Audit Report](SECURITY-AUDIT-REPORT.md).
