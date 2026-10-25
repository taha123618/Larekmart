# Security Architecture & Policies

Security architecture, authentication standards, perimeter protection, and data security guidelines across Larekmart.

---

## 1. Authentication & Authorization (Clerk & RBAC)

- **Centralized Identity**: Authentication is delegated to **Clerk** across all frontends and downstream services.
- **Session Claims**: User roles are held in `sessionClaims.metadata.role` (`"user" | "admin"`), defined as `CustomJwtSessionClaims` in `@repo/types`.
- **Backend Route Guards**:
  - Express (`product-service`, `auth-service`, `cart-service`, `analytic-service`): `shouldBeUser` / `shouldBeAdmin` middleware.
  - Fastify (`order-service`, `catalog-service`, `search-service`, `user-service`): `preHandler: shouldBeUser | shouldBeAdmin`.
  - Hono (`payment-service`, `inventory-service`, `media-service`): middleware checking Clerk session claims or trusted gateway headers.
  - Koa (`shipping-service`): `requireAdminOrInternal` middleware.
- **Admin UI Gating**: `apps/admin/src/middleware.ts` routes non-admins to `/unauthorized`. Frontend gating provides defense-in-depth; all mutating operations are strictly re-authorized on backend microservices.
- **Admin Self-Promotion Bootstrap**:
  - `POST /api/claim-admin` in `apps/admin` is fail-closed: disabled by default unless `ALLOW_ADMIN_CLAIM === "true"` and `ADMIN_REGISTRATION_SECRET` is set.
  - Requires valid Clerk authentication and timing-safe comparison on the `x-admin-claim-secret` header.
- **Super Admin Governance & Delegated Administration**:
  - **Super Admin Authority**: Global kill-switch operations (`isSellerEnabled` in `system_settings`) and granting/revoking delegations require full Super Admin authority (`sessionClaims.metadata.role === "admin"`).
  - **Delegated Manage Admin**: Operational marketplace administration (e.g., managing seller storefronts, staff, and policies) can be delegated via `admin_delegations` records in `seller-service` with specific scopes (e.g. `manage_sellers`).
  - **Header-Level Authority Binding**: Downstream services verify either direct Super Admin role or `x-user-can-manage-sellers: true` for delegated seller operations.

---

## 2. Ingress & Perimeter Security (API Gateway)

The centralized API Gateway (`apps/api-gateway`, Fastify 5 on port 8080/8090) serves as the primary ingress perimeter:

- **Client Header Stripping**:
  - Client-supplied internal headers (`x-user-id`, `x-user-role`, `x-internal-secret`, `x-user-is-seller`, `x-user-can-manage-sellers`) are unconditionally stripped on all incoming requests before routing downstream.
  - Mitigates user impersonation, seller privilege spoofing, and privilege escalation attacks.
- **Trusted Identity Propagation**:
  - The Gateway verifies Clerk session tokens at the perimeter and injects verified `GATEWAY_HEADERS.USER_ID` and `GATEWAY_HEADERS.USER_ROLE` downstream, signed with `GATEWAY_HEADERS.INTERNAL_SECRET`.
  - Propagates verified seller context downstream via `x-user-is-seller` and delegated management capability via `x-user-can-manage-sellers`.
- **Distributed Rate Limiting**:
  - Enforced per IP and authenticated user via Redis sliding window / token bucket.
  - Configured with separate limits for sensitive routes (`auth`, `search`, `orders`, `media`, `general`).
- **Resilience & Information Disclosure Mitigation**:
  - Opossum circuit breakers isolate failing downstream services.
  - Idempotent GET/HEAD requests support bounded retries with exponential backoff.
  - Upstream errors are normalized; internal stack traces, database strings, and private IPs are stripped from responses.

---

## 3. Inter-Service Trust & Timing Attack Mitigation

- **Asynchronous Decoupling**: Business workflows communicate asynchronously via Apache Kafka (`@repo/kafka`). Direct HTTP calls between microservices are prohibited.
- **Constant-Time Secret Verification**:
  - Services accepting gateway traffic authenticate `x-internal-secret` using constant-time cryptographic comparison (`crypto.timingSafeEqual`) on SHA-256 digests (`safeTimingCompare`).
  - Implemented across all 10 downstream microservices (`product-service`, `order-service`, `cart-service`, `search-service`, `inventory-service`, `media-service`, `payment-service`, `auth-service`, `analytic-service`, `shipping-service`).
  - Prevents timing side-channel attacks against `INTERNAL_SERVICE_SECRET`.
- **Production Secret Validation**:
  - `apps/api-gateway/src/config/env.ts` enforces `superRefine` validation: running in `production` with the default development secret placeholder fails immediately at startup.

---

## 4. Broken Object-Level Authorization (IDOR Prevention)

- **Strict Resource Ownership**:
  - `order-service` verifies that the accessed order belongs to the requester: `order.userId === request.userId || request.userRole === "admin"`.
  - `user-service` scopes customer operations to `/me` or verified `request.userId`.
  - `cart-service` binds operations to verified `userId` or unguessable cryptographic guest tokens (`x-guest-token`).
  - Line-item price verification: COD and Stripe order totals are recomputed server-side from authoritative catalog prices (`getServerProductPricesPaisa`), rejecting client-declared price discrepancies with `409 Conflict`.

---

## 5. Injection Vulnerability Protections

- **Parameterized Queries Everywhere**:
  - Zero raw SQL concatenations or unescaped template literals across the codebase.
  - Prisma queries in `@repo/product-db`, `@repo/inventory-db`, `@repo/catalog-db`, `@repo/shipping-db`, and `@repo/user-db` use typed client methods. Zero occurrences of `$queryRawUnsafe`.
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
  - Configured across the API Gateway and backend services against explicit frontend origins (`CLIENT_URL`, `ADMIN_URL`).
  - Wildcard origins (`origin: "*"`) are strictly forbidden when `credentials: true` is enabled to prevent origin reflection vulnerabilities.
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

---

## 10. Container & Supply Chain Security

- **Hardened Image Baseline**: All Docker container workloads adhere to the Docker Hardened Image (DHI) standard with multi-stage builds and non-root execution (UID 1000/1001/10001).
- **Vulnerability Scans**: Docker Scout Quickview (`pnpm docker:scout`) enforces zero Critical and zero High remediable CVEs.

---

## 11. Comprehensive Security Audit Report

For an in-depth, code-level vulnerability analysis, IDOR inspection, and defense-in-depth verification across all 23 microservices and frontends, consult the dedicated [Comprehensive Security Audit Report](SECURITY-AUDIT-REPORT.md).
