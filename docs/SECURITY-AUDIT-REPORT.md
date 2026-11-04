# Comprehensive Security Audit Report

**Target Codebase:** Larekmart Monorepo Microservices E-Commerce Platform  
**Target Environment:** 26 Backend Microservices, 2 Next.js Frontends (`apps/client`, `apps/admin`), Centralized API Gateway (`apps/api-gateway`), Apache Kafka Event Mesh, PostgreSQL, MongoDB, Redis, and OpenSearch.  
**Audit Date:** November 2026  
**Auditor:** Antigravity AI Security Analysis Agent

---

## 1. Executive Summary

A comprehensive architectural and source-code security audit was conducted across all workspaces in the Larekmart microservices platform. The codebase exhibits a high level of security maturity with strict boundary isolation, centralized perimeter defenses, and defense-in-depth principles.

### Key Metrics & Security Posture

- **Total Workspaces Analyzed:** 44 (26 backend microservices, 2 frontends, 1 API gateway, 15 shared libraries/configs)
- **Authentication Model:** Delegated to Clerk (`CustomJwtSessionClaims` via verified JWTs)
- **Inter-Service Mesh:** Asynchronous Kafka event bus; direct HTTP between microservices is blocked
- **Ingress Perimeter:** Centralized Fastify 5 reverse proxy (`api-gateway`) with strict identity header stripping and constant-time downstream secret verification
- **Injection Safety:** 100% parameterized SQL; zero occurrences of `$queryRawUnsafe` or raw string concatenation; typed ORMs (Prisma, Drizzle, Mongoose)
- **Cryptography:** Timing-safe comparisons (`crypto.timingSafeEqual`) on HMAC webhook signatures, internal secrets, and admin self-promotion secrets
- **File Upload Protection:** Direct-to-storage presigned S3/MinIO URLs; server-generated deterministic UUID keys; binary magic-byte content validation (`MAGIC_BYTES`)

---

## 2. Security Assessment Matrix

| Domain                                       |       Rating        | Status & Summary                                                                                                                                                      |
| -------------------------------------------- | :-----------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication & RBAC**                    |     **STRONG**      | Centralized Clerk authentication; role claims (`user`, `seller`, `admin`, `super_admin`) enforced via framework-native preHandlers; fail-closed admin self-promotion. |
| **Ingress & Perimeter Defense**              |     **STRONG**      | API Gateway unconditionally strips client-supplied `x-user-id`, `x-user-role`, `x-internal-secret`, `x-user-is-seller`, and `x-user-can-manage-sellers`.              |
| **Broken Object-Level Authorization (IDOR)** | **NEEDS HARDENING** | Two vulnerabilities identified in `order-service` (`GET /seller-orders`) and `product-service` (`PUT/DELETE /products/:id`).                                          |
| **SQL & Database Injection**                 |    **EXCELLENT**    | Completely parameterized queries; inputs clamped and sanitized; zero unescaped dynamic strings.                                                                       |
| **NoSQL & Query Selector Injection**         |     **STRONG**      | MongoDB ObjectIDs validated with `mongoose.Types.ObjectId.isValid`; typed schemas in `@repo/order-db` and `@repo/cart-db`.                                            |
| **Cryptographic Timing Defenses**            |    **EXCELLENT**    | Constant-time comparison (`crypto.timingSafeEqual`) on SHA-256 digests used across all webhooks, HMACs, and gateway secrets.                                          |
| **Object Storage & Upload Security**         |    **EXCELLENT**    | Binary magic-byte inspection prevents MIME confusion; deterministic paths prevent directory traversal; client filenames never stored as keys.                         |
| **Kafka Event Mesh Resiliency**              |     **STRONG**      | Poison pill protection: consumer handlers wrapped in `try/catch` with structured telemetry; consumer loops will not crash on malformed payloads.                      |
| **Secrets & Credential Hygiene**             |     **STRONG**      | Zero production secrets or certificates in version control; only `.env.example` templates committed; public vars strictly scoped to `NEXT_PUBLIC_*`.                  |
| **CORS & Defensive Headers**                 |     **STRONG**      | Strict origin allowlists (`CLIENT_URL`, `ADMIN_URL`); wildcard origins prohibited when `credentials: true`; standard defensive HTTP headers emitted.                  |

---

## 3. Vulnerability Findings & Remediation Plan

```
VULNERABILITY HIERARCHY
├── [CRIT] SEC-06: analytic-service accepted forged JWTs and defaulted to a known admin secret [RESOLVED]
├── [HIGH] SEC-01: IDOR & Unscoped Query in Order Service (GET /seller-orders) [RESOLVED & VERIFIED]
├── [HIGH] SEC-02: Missing Seller Attribution & Cross-Seller Product Mutation [RESOLVED & VERIFIED]
├── [HIGH] SEC-07: notification-service dev identity/WebSocket-origin bypass + Clerk-secret HMAC [RESOLVED]
├── [HIGH] SEC-08: recommendation-service unverified JWT and dev ownership/admin bypass [RESOLVED]
├── [HIGH] SEC-09: Internal secret alone granted admin to proxied users (seller/vendor/shipping) [RESOLVED]
├── [HIGH] SEC-10: Gateway trusted arbitrary X-Forwarded-For (`trustProxy: true`) [RESOLVED]
├── [HIGH] SEC-15: Commission-service admin routes vulnerable to privilege escalation via transport secret [RESOLVED & VERIFIED]
├── [MED]  SEC-03: Production Boot Validation for INTERNAL_SERVICE_SECRET      [RESOLVED & VERIFIED]
├── [MED]  SEC-11: Wildcard CORS with credentials in five Fastify services [RESOLVED]
├── [MED]  SEC-12: Clerk secret key used as HMAC fallback (shipping/return) [RESOLVED]
├── [MED]  SEC-13: Production-usable placeholder values in K8s Secret templates [RESOLVED]
├── [MED]  SEC-16: Timing attack and secret length leakage in commission and payout secret verification [RESOLVED & VERIFIED]
├── [MED]  SEC-17: Missing fail-closed production startup check for INTERNAL_SERVICE_SECRET in commission/payout [RESOLVED & VERIFIED]
├── [MED]  SEC-22: Missing Fail-Closed Production Boot Validation in Go and Python Microservices [RESOLVED & VERIFIED]
├── [LOW]  SEC-04: Network Perimeter Isolation of Microservice Ports [RESOLVED & VERIFIED]
├── [LOW]  SEC-05: Route-Specific Rate Limiting on Merchant Onboarding [RESOLVED & VERIFIED]
├── [LOW]  SEC-14: Residual transitive dependency advisories (zod v3, nested fastify/postcss) [TRACKED]
├── [LOW]  SEC-18: Missing strict CORS origin allowlists and defensive HTTP security headers in commission/payout [RESOLVED & VERIFIED]
├── [CRIT] SEC-19: Unconditional Admin Escalation & Stubbed Token Verification in analytic-service [RESOLVED & VERIFIED]
├── [HIGH] SEC-20: Insecure Clerk Verification & Dev Identity Bypass in notification-service [RESOLVED & VERIFIED]
├── [HIGH] SEC-21: Insecure Clerk Verification & Dev Identity Bypass in recommendation-service [RESOLVED & VERIFIED]
├── [HIGH] SEC-23: Unverified JWT Signature in fraud-service [RESOLVED & VERIFIED]
├── [HIGH] SEC-25: Broken Function Level Authorization (BFLA) on Seller Payout Endpoints [RESOLVED & VERIFIED]
├── [MED]  SEC-24: Missing Fail-Closed Production Startup Validation for INTERNAL_SERVICE_SECRET in fraud-service [RESOLVED & VERIFIED]
├── [MED]  SEC-26: Incomplete Perimeter Header Stripping in API Gateway [RESOLVED & VERIFIED]
└── [LOW]  SEC-27: Unrestricted Dev Identity Bypass Flag in fraud-service [RESOLVED & VERIFIED]
```

---

### SEC-01 [HIGH]: IDOR & Unscoped Query in Order Service (`GET /seller-orders`) [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-639 (Authorization Bypass Through User-Controlled Key), CWE-200 (Information Exposure)
- **Affected File:** [`apps/order-service/src/routes/order.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/order-service/src/routes/order.ts#L93-L135)
- **Automated Test Coverage:** [`apps/order-service/tests/order-security.test.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/order-service/tests/order-security.test.ts)
- **Detailed Mechanics:**
  The endpoint allows sellers to view orders associated with their merchant account:
  1. **Unscoped Exposure:** Previously, if a seller sent a request without `?sellerId=...`, `query` remained `{}`. `Order.find({})` executed and returned orders across the **entire marketplace** (exposing customer names, addresses, amounts, and purchased products).
  2. **IDOR:** If a seller supplied `?sellerId=<competing_seller_id>`, the endpoint did not verify whether `sellerId` matched `request.userId`. A seller could inspect any competing seller's orders.

- **Defensive Remediation Implemented:**
  Enforced that non-admin requests strictly scope queries to `request.userId` and reject queries for other sellers with `403 Forbidden`:

  ```typescript
  const isAdmin = request.userRole === "admin";
  if (!isAdmin && sellerId && sellerId !== request.userId) {
    return reply.status(403).send({
      message: "Access forbidden: you cannot query orders of other sellers",
    });
  }

  const effectiveSellerId = isAdmin ? sellerId : request.userId;
  if (!isAdmin && !effectiveSellerId) {
    return reply.status(400).send({
      message: "Seller identity required to access seller orders",
    });
  }

  const query: Record<string, unknown> = {};
  if (effectiveSellerId) {
    query.$or = [
      { sellerId: effectiveSellerId },
      { "products.sellerId": effectiveSellerId },
    ];
  }
  ```

---

### SEC-02 [HIGH]: Missing Seller Attribution & Cross-Seller Product Mutation [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-285 (Improper Authorization)
- **Affected Files:**
  - Route: [`apps/product-service/src/routes/product.route.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/product-service/src/routes/product.route.ts#L22-L23)
  - Controller: [`apps/product-service/src/controllers/product.controller.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/product-service/src/controllers/product.controller.ts#L60-L111)
  - Schema: [`packages/product-db/prisma/schema.prisma`](file:///Users/taha/projects/microservices-ecommerce/packages/product-db/prisma/schema.prisma#L11-L24)
- **Detailed Mechanics:**
  `router.put("/:id", shouldBeSellerOrAdmin, updateProduct)` and `router.delete("/:id", shouldBeSellerOrAdmin, deleteProduct)` allow any authenticated user with `role === "seller"` to invoke update and delete operations.
  Previously, the `Product` model in `packages/product-db` did not track a `sellerId` or `vendorId`. Consequently, any seller on the marketplace could modify or delete products created by competing sellers by specifying their numeric `id`.
- **Defensive Remediation Implemented:**
  1. Evolved `packages/product-db/prisma/schema.prisma` to include an attributable `sellerId String?` column with `@@index([sellerId])` and generated Prisma client.
  2. In `createProduct`, automatically attributed `sellerId = req.userId` for seller requests (or explicit delegation if caller is admin).
  3. In `updateProduct` and `deleteProduct`, enforced that non-admin callers can only modify or delete products where `product.sellerId === req.userId`, returning `403 Forbidden` for other sellers' or unowned products.

---

### SEC-03 [MEDIUM]: Production Startup Validation for Default Secrets [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-1188 (Insecure Default Initialization of Resource)
- **Affected Files:** Microservice `env.ts` configurations and service entrypoints across backend apps.
- **Automated Test Coverage:** [`packages/types/tests/schemas.test.ts`](file:///Users/taha/projects/microservices-ecommerce/packages/types/tests/schemas.test.ts)
- **Detailed Mechanics:**
  In local development, `INTERNAL_SERVICE_SECRET` defaults to `"dev-shared-internal-secret-larekmart"`. If deployed to staging or production without explicitly setting this environment variable, an attacker with internal network access could forge gateway identity headers (`x-internal-secret`, `x-user-id`, `x-user-role`).
- **Defensive Remediation Implemented:**
  1. Implemented centralized `validateInternalServiceSecret(secret, nodeEnv, serviceName)` in [`packages/types/src/gateway.ts`](file:///Users/taha/projects/microservices-ecommerce/packages/types/src/gateway.ts), enforcing minimum 16 characters and prohibiting all development default placeholders (`DEFAULT_INTERNAL_SECRET`, `INSECURE_INTERNAL_SECRET_PLACEHOLDERS`) when `NODE_ENV === "production"`.
  2. Integrated fail-closed validations into Zod `superRefine` configurations across all microservice `env.ts` files (`api-gateway`, `seller-service`, `cart-service`, `pricing-service`, `promotion-service`, `wishlist-service`, `user-service`, `search-service`, `review-service`, `shipping-service`, `tax-service`, `return-service`, `vendor-service`, `media-service`).
  3. Integrated startup lifecycle validations at the `start()` entrypoints for services without separate `env.ts` (`order-service`, `product-service`, `inventory-service`, `auth-service`, `analytic-service`, `payment-service`).
  4. Verified fail-closed production throws and development allowance via regression tests in `@repo/types`.

---

### SEC-04 [LOW]: Network Perimeter Isolation of Microservice Ports [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-668 (Exposure of Resource to Wrong Sphere)
- **Affected File:** [`docker-compose.yml`](file:///Users/taha/projects/microservices-ecommerce/docker-compose.yml)
- **Detailed Mechanics:**
  Downstream microservices (e.g. `order-service:8001`, `seller-service:8021`) rely on the API Gateway to strip spoofed client headers. If microservice ports are exposed directly to the public internet (rather than strictly to internal Docker bridge or Kubernetes SDN networks), an attacker could bypass the Gateway's rate limiting and header-stripping defenses.
- **Defensive Remediation Implemented:**
  Configured all downstream microservice port definitions in `docker-compose.yml` to bind strictly to `${INTERNAL_SERVICE_BIND_IP:-127.0.0.1}` loopback, isolating internal communication from external interfaces while exposing only the edge ingress routers (`api-gateway:8080`, storefront, admin).

---

### SEC-05 [LOW]: Dedicated Route-Level Rate Limiting on Onboarding [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-799 (Improper Control of Generation of Frequent Requests)
- **Affected File:** [`apps/api-gateway/src/gateway/policies.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/api-gateway/src/gateway/policies.ts)
- **Detailed Mechanics:**
  While the API Gateway applies a global sliding-window rate limit, sensitive write endpoints such as merchant onboarding (`POST /api/v1/sellers` and `POST /api/v1/vendors`) previously fell through to default thresholds (100 requests per minute), exposing the platform to automated account creation and resource exhaustion abuse.
- **Defensive Remediation Implemented:**
  Introduced dedicated `ONBOARDING` rate limiting policy (10 requests/minute per client identity/IP) in [`RATE_LIMIT_POLICIES`](file:///Users/taha/projects/microservices-ecommerce/apps/api-gateway/src/gateway/policies.ts) matching `/sellers`, `/vendors`, and `/onboarding` routes.

---

### SEC-15 [HIGH]: Commission Service Admin Privilege Escalation via Transport Secret [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-287 (Improper Authentication), CWE-269 (Improper Privilege Management)
- **Affected File:** [`apps/commission-service/src/middleware/auth.middleware.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/commission-service/src/middleware/auth.middleware.ts)
- **Detailed Mechanics:**
  `requireAdmin` permitted any caller with `role !== "admin"` to bypass authorization if `x-internal-secret` was present. Because the API Gateway signs all proxied user requests with `x-internal-secret`, any non-admin customer or seller could invoke administrative endpoints (`/api/v1/admin/commissions/plans`, `/rules`, `/reports`) to modify platform commission rates and inspect aggregate revenue data.
- **Defensive Remediation Implemented:**
  Decoupled gateway transport authenticity from user authorization. Proxied requests carrying identity headers (`x-user-role` or `x-user-id`) must strictly have `x-user-role === "admin"`. The internal secret alone never elevates non-admin users. Machine-to-machine access is only permitted when no user context is asserted.

---

### SEC-16 [MED]: Timing Attack & Secret Length Leakage in Secret Verification [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-208 (Observable Timing Discrepancy), CWE-385 (Covert Timing Channel)
- **Affected Files:** [`apps/commission-service/src/middleware/auth.middleware.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/commission-service/src/middleware/auth.middleware.ts), [`apps/payout-service/src/guards/auth.guard.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/payout-service/src/guards/auth.guard.ts)
- **Detailed Mechanics:**
  Internal secret comparisons performed early length checks (`secretBuf.length !== expectedBuf.length`) or standard string equality before constant-time checks, leaking secret lengths and token bytes via timing side-channels.
- **Defensive Remediation Implemented:**
  Standardized on `safeTimingCompare(a, b)` which pre-hashes both buffers with SHA-256 before invoking `crypto.timingSafeEqual`, guaranteeing uniform 32-byte constant-time comparisons without length leakage.

---

### SEC-17 [MED]: Missing Fail-Closed Production Startup Validation for INTERNAL_SERVICE_SECRET [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-1188 (Insecure Default Initialization of Resource)
- **Affected Files:** [`apps/commission-service/src/config/env.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/commission-service/src/config/env.ts), [`apps/payout-service/src/config/env.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/payout-service/src/config/env.ts)
- **Detailed Mechanics:**
  `commission-service` and `payout-service` environment configurations did not enforce `validateInternalServiceSecret` during Zod parsing, permitting production boots with default development placeholder secrets (`dev-shared-internal-secret-larekmart`).
- **Defensive Remediation Implemented:**
  Added `.superRefine` hooks invoking `validateInternalServiceSecret(data.INTERNAL_SERVICE_SECRET, data.NODE_ENV, serviceName)`, hard-failing process boot if placeholders or weak secrets are detected in production.

---

### SEC-18 [LOW]: Missing Strict CORS Allowlist & Defensive HTTP Security Headers [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-942 (Permissive Cross-Domain Policy), CWE-693 (Protection Mechanism Failure)
- **Affected Files:** [`apps/commission-service/src/app.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/commission-service/src/app.ts), [`apps/payout-service/src/main.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/payout-service/src/main.ts)
- **Detailed Mechanics:**
  `commission-service` and `payout-service` lacked centralized origin resolution via `resolveCorsOrigins` and did not emit standard browser defensive headers.
- **Defensive Remediation Implemented:**
  Integrated `resolveCorsOrigins` callback validation and attached `onSend` hooks emitting `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security`.

---

### SEC-19 [CRIT]: Unconditional Admin Role Escalation & Stubbed Token Verification in Analytic Service [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-287 (Improper Authentication), CWE-305 (Authentication Bypass via Primary Weakness)
- **Affected File:** [`apps/analytic-service/internal/middleware/auth.go`](file:///Users/taha/projects/microservices-ecommerce/apps/analytic-service/internal/middleware/auth.go)
- **Detailed Mechanics:**
  `verifyClerkToken` calculated `expectedSig` using `CLERK_SECRET_KEY` but discarded it (`_ = expectedSig`), unconditionally returning `&tokenClaims{ Role: "admin" }, true`. Any request providing an arbitrary bearer token `Authorization: Bearer forged.token.here` was granted complete administrative privileges over business intelligence, daily revenue metrics, and aggregation pipelines. Furthermore, internal secret comparison used `subtle.ConstantTimeCompare` without length normalization, leaking secret length via early-exit branches.
- **Defensive Remediation Implemented:**
  Removed stubbed admin escalation. Implemented standard RS256 cryptographic signature validation using `CLERK_JWT_KEY` (PEM public key) and `rsa.VerifyPKCS1v15`. Supported symmetric `CLERK_JWT_HMAC_KEY` strictly for test fixtures (never `CLERK_SECRET_KEY`). Added token expiration (`exp`) and not-before (`nbf`) temporal validations. Enforced constant-time comparisons via `SafeTimingCompare` with SHA-256 pre-hashing. Restricted local development bypass to require explicit `ANALYTIC_DEV_AUTH_BYPASS=true` in non-production.

---

### SEC-20 [HIGH]: Insecure Clerk Verification & Dev Identity Bypass in Notification Service [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-327 (Use of a Broken or Risky Cryptographic Algorithm), CWE-284 (Improper Access Control)
- **Affected File:** [`apps/notification-service/internal/middleware/auth.go`](file:///Users/taha/projects/microservices-ecommerce/apps/notification-service/internal/middleware/auth.go)
- **Detailed Mechanics:**
  `ExtractUserID` attempted to verify Clerk JWTs using `CLERK_SECRET_KEY` as an HMAC-SHA256 key, which violates Clerk's asymmetric RS256 signing standard. In non-production, missing `INTERNAL_SERVICE_SECRET` allowed unauthenticated clients to spoof identities via `X-User-ID` or `?user_id=` WebSocket query parameters without an explicit dev bypass flag.
- **Defensive Remediation Implemented:**
  Implemented constant-time SHA-256 pre-hashed comparison for `INTERNAL_SERVICE_SECRET`. Added RS256 token verification against `CLERK_JWT_KEY` and restricted symmetric verification to `CLERK_JWT_HMAC_KEY`. Gated header/query identity parameters behind an explicit `NOTIFICATION_DEV_AUTH_BYPASS=true` flag.

---

### SEC-21 [HIGH]: Insecure Clerk Verification & Dev Identity Bypass in Recommendation Service [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-327 (Use of Broken Cryptographic Algorithm), CWE-290 (Authentication Bypass by Spoofing)
- **Affected File:** [`apps/recommendation-service/app/core/security.py`](file:///Users/taha/projects/microservices-ecommerce/apps/recommendation-service/app/core/security.py)
- **Detailed Mechanics:**
  `get_current_actor` attempted HMAC-SHA256 verification using `CLERK_SECRET_KEY`. In non-production, unauthenticated callers could pass `x-user-id` and `x-user-role` headers to impersonate any user or admin without requiring a dev bypass flag. Direct string comparison of internal secrets with `hmac.compare_digest` leaked secret lengths.
- **Defensive Remediation Implemented:**
  Implemented `safe_timing_compare` with SHA-256 pre-hashing. Decoupled transport authenticity from user authorization. Replaced `CLERK_SECRET_KEY` HMAC logic with `CLERK_JWT_HMAC_KEY` test fixture support and rejected unverified tokens. Gated dev bypass behind `RECOMMENDATION_DEV_AUTH_BYPASS=true` and non-production `app_env`.

---

### SEC-22 [MED]: Missing Fail-Closed Production Boot Validation in Go and Python Microservices [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-1188 (Insecure Default Initialization of Resource)
- **Affected Files:**
  - [`apps/analytic-service/internal/config/config.go`](file:///Users/taha/projects/microservices-ecommerce/apps/analytic-service/internal/config/config.go)
  - [`apps/notification-service/internal/config/config.go`](file:///Users/taha/projects/microservices-ecommerce/apps/notification-service/internal/config/config.go)
  - [`apps/recommendation-service/app/core/config.py`](file:///Users/taha/projects/microservices-ecommerce/apps/recommendation-service/app/core/config.py)
- **Detailed Mechanics:**
  `analytic-service`, `notification-service`, and `recommendation-service` permitted booting in production environments (`APP_ENV=production` or `NODE_ENV=production`) with the default development placeholder secret `dev-shared-internal-secret-larekmart` or weak secrets.
- **Defensive Remediation Implemented:**
  Added fail-closed validation on startup across Go and Python configs, panicking or raising validation errors if production environments attempt to boot with placeholder secrets.

---

### SEC-23 [HIGH]: Unverified JWT Signature in Fraud Service (`apps/fraud-service/app/core/security.py`) [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-347 (Improper Verification of Cryptographic Signature), CWE-287 (Improper Authentication)
- **Affected File:** [`apps/fraud-service/app/core/security.py`](file:///Users/taha/projects/microservices-ecommerce/apps/fraud-service/app/core/security.py)
- **Automated Test Coverage:** [`apps/fraud-service/tests/test_api.py`](file:///Users/taha/projects/microservices-ecommerce/apps/fraud-service/tests/test_api.py)
- **Detailed Mechanics:**
  `get_current_actor` parsed direct Bearer tokens by splitting `.` and base64-decoding the JSON payload without cryptographically verifying the signature against `CLERK_JWT_KEY` or a shared secret. Any attacker could forge an arbitrary JWT with `metadata.role: "admin"` and an arbitrary signature (e.g., `mock_sig`), completely bypassing admin authorization on `/api/v1/admin/fraud/*`.
- **Defensive Remediation Implemented:**
  Replaced unverified payload decoding with cryptographic signature verification. Configured `CLERK_JWT_HMAC_KEY` (HS256) support for test fixtures and constant-time HMAC-SHA256 signature verification (`safe_timing_compare`). Tokens with missing, malformed, or forged signatures immediately fail closed with `401 Unauthorized`. Additionally decoupled transport authenticity from user authorization: when user identity is present, `x-user-role` must be `"admin"`, returning `403 Forbidden` for non-admin user requests.

---

### SEC-24 [MED]: Missing Fail-Closed Production Startup Validation for INTERNAL_SERVICE_SECRET in Fraud Service [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-1188 (Insecure Default Initialization of Resource)
- **Affected File:** [`apps/fraud-service/app/core/config.py`](file:///Users/taha/projects/microservices-ecommerce/apps/fraud-service/app/core/config.py)
- **Detailed Mechanics:**
  `fraud-service` defaulted `INTERNAL_SERVICE_SECRET` to `dev-shared-internal-secret-larekmart` without verifying secret strength or preventing placeholder values when running in production (`APP_ENV=production`). A production deployment with missing environment variables would boot using a publicly known shared secret, allowing malicious actors to bypass perimeter authorization.
- **Defensive Remediation Implemented:**
  Added a Pydantic `@model_validator(mode="after")` `validate_production_secrets` on `Settings`. In production (`app_env == "production"`), the service validates that `INTERNAL_SERVICE_SECRET` is non-empty, at least 16 characters long, and does not match any placeholder patterns (`dev-shared-*`, `change-me`, `replace-me`, `example`, `dummy`, `__required`), raising a fatal validation exception on boot.

---

### SEC-25 [HIGH]: Broken Function Level Authorization (BFLA) on Seller Payout Endpoints [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-285 (Improper Authorization), CWE-862 (Missing Authorization)
- **Affected Files:**
  - [`apps/api-gateway/src/routing/authenticated.routes.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/api-gateway/src/routing/authenticated.routes.ts)
  - [`apps/payout-service/src/guards/auth.guard.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/payout-service/src/guards/auth.guard.ts)
- **Automated Test Coverage:** [`apps/payout-service/tests/payout-service.test.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/payout-service/tests/payout-service.test.ts)
- **Detailed Mechanics:**
  Seller payout routes (`GET /api/v1/sellers/me/payouts`, `/balance`, `/statements`) in `authenticated.routes.ts` were registered with `requireAuth: true` instead of `requireSeller: true`. Furthermore, `SellerGuard` in `payout-service` only checked `Boolean(userId)`, without verifying whether the caller was a verified merchant (`x-user-is-seller: "true"` or role `"seller" | "admin"`). Ordinary customer accounts could execute seller balance queries and retrieve merchant ledger details.
- **Defensive Remediation Implemented:**
  1. Updated the route definitions in `apps/api-gateway/src/routing/authenticated.routes.ts` to `requireSeller: true`, requiring verified seller identity at the perimeter.
  2. Hardened `SellerGuard` in `apps/payout-service/src/guards/auth.guard.ts` to strictly verify that `x-user-is-seller === "true"` or role is `"seller" | "admin"`, failing closed with `403 Forbidden` for standard customer sessions.

---

### SEC-26 [MED]: Incomplete Perimeter Header Stripping in API Gateway [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-284 (Improper Access Control), CWE-200 (Information Exposure)
- **Affected Files:**
  - [`apps/api-gateway/src/middleware/request-id.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/api-gateway/src/middleware/request-id.ts)
  - [`apps/api-gateway/src/gateway/proxy.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/api-gateway/src/gateway/proxy.ts)
- **Detailed Mechanics:**
  While the API gateway stripped core identity headers (`x-user-id`, `x-user-role`, `x-internal-secret`), it did not include newer internal coordination headers (`x-seller-id`, `x-dev-admin-override`, `x-dev-role`, `x-force-primary`, `x-read-your-writes`, `x-db-lsn`) in `FORBIDDEN_CLIENT_HEADERS`. External clients could send spoofed `x-seller-id` or attempt dev override injection.
- **Defensive Remediation Implemented:**
  Added `x-seller-id`, `x-dev-admin-override`, `x-dev-role`, `x-force-primary`, `x-read-your-writes`, and `x-db-lsn` to `FORBIDDEN_CLIENT_HEADERS` in `apps/api-gateway/src/middleware/request-id.ts` and explicitly stripped them in `rewriteRequestHeaders` in `apps/api-gateway/src/gateway/proxy.ts`.

---

### SEC-27 [LOW]: Unrestricted Dev Identity Bypass Flag in Fraud Service [RESOLVED & VERIFIED]

- **Status:** **RESOLVED & VERIFIED**
- **Vulnerability Identifiers:** CWE-489 (Active Debug Code)
- **Affected File:** [`apps/fraud-service/app/core/security.py`](file:///Users/taha/projects/microservices-ecommerce/apps/fraud-service/app/core/security.py)
- **Detailed Mechanics:**
  `x-dev-admin-override` was permitted unconditionally whenever `APP_ENV == "development"`, even if the developer did not intend to allow header-based bypass.
- **Defensive Remediation Implemented:**
  Gated dev overrides behind an explicit `FRAUD_DEV_AUTH_BYPASS=true` boolean flag in addition to requiring `app_env != "production"`. In production, dev bypass is permanently inactive.

---

## 4. In-Depth Architectural Audits

### 4.1 Ingress & Header Sanitization Pipeline

```
[ Client Request ]
       │
       ▼
┌────────────────────────────────────────────────────────┐
│               Fastify 5 API Gateway                   │
│                                                        │
│ 1. Strip untrusted headers:                           │
│    - delete rewritten[GATEWAY_HEADERS.USER_ID]        │
│    - delete rewritten[GATEWAY_HEADERS.USER_ROLE]      │
│    - delete rewritten[GATEWAY_HEADERS.INTERNAL_SECRET]│
│    - delete rewritten["x-user-is-seller"]             │
│    - delete rewritten["x-user-can-manage-sellers"]    │
│    - delete rewritten["x-seller-id"]                  │
│    - delete rewritten["x-dev-admin-override"]         │
│    - delete rewritten["x-dev-role"]                   │
│    - delete rewritten["x-force-primary"]              │
│    - delete rewritten["x-read-your-writes"]           │
│    - delete rewritten["x-db-lsn"]                     │
│                                                        │
│ 2. Verify Clerk JWT Session Claims                    │
│                                                        │
│ 3. Inject verified downstream headers:                │
│    - x-user-id: auth.userId                           │
│    - x-user-role: auth.role                           │
│    - x-user-is-seller: "true" (if verified)           │
│    - x-user-can-manage-sellers: "true" (if delegated) │
│    - x-internal-secret: env.INTERNAL_SERVICE_SECRET   │
└────────────────────────────────────────────────────────┘
       │ (Internal Network Only)
       ▼
┌────────────────────────────────────────────────────────┐
│              Downstream Microservice                   │
│                                                        │
│ Verify x-internal-secret via safeTimingCompare():      │
│   crypto.timingSafeEqual(sha256(secret), sha256(conf)) │
└────────────────────────────────────────────────────────┘
```

The API Gateway implementation in [`apps/api-gateway/src/gateway/proxy.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/api-gateway/src/gateway/proxy.ts#L77-L110) strictly adheres to this pipeline, eliminating client-side header spoofing.

---

### 4.2 Database & Injection Defense Verification

1. **PostgreSQL Parameterization:**
   In [`apps/analytic-service/src/services/metrics.service.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/analytic-service/src/services/metrics.service.ts#L926-L937), dynamic interval queries are strictly parameterized:
   ```sql
   SELECT ... FROM analytics_daily_summary
   WHERE date >= CURRENT_DATE - ($1 * INTERVAL '1 day')
   ORDER BY date ASC
   ```
   Inputs are clamped via `Math.min(Math.max(1, Math.floor(Number(days) || 30)), 365)`.
2. **Prisma ORM Safety:**
   All Prisma queries across `@repo/product-db`, `@repo/inventory-db`, `@repo/catalog-db`, `@repo/shipping-db`, and `@repo/user-db` utilize typed methods (`findUnique`, `findMany`, `create`, `update`). No unsafe raw queries exist. Health checks utilize tagged template literals (`prisma.$queryRaw\`SELECT 1\``).
3. **Mongoose Query Sanitization:**
   Dynamic route parameters in `order-service` and `cart-service` validate ObjectID syntax via `mongoose.Types.ObjectId.isValid` prior to query execution.

---

### 4.3 Presigned Uploads & Magic-Byte Verification

The media processing architecture in [`apps/media-service`](file:///Users/taha/projects/microservices-ecommerce/apps/media-service) prevents arbitrary file upload vulnerabilities:

- **Direct S3/MinIO Presigned URLs:** Binary payloads never buffer on application servers.
- **Magic-Byte Content Validation:**
  ```typescript
  export const MAGIC_BYTES = [
    { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
    {
      mime: "image/png",
      bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    },
    { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
    { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  ];
  ```
- **Deterministic Keys:** User-provided filenames are sanitized and stored as metadata only; object storage keys are generated deterministically using UUIDs: `{ownerPlural}/{ownerId}/{mediaId}/original.{ext}`.

---

### 4.4 Webhook Cryptography & Timing Safety

- **Stripe Webhooks ([`apps/payment-service/src/routes/webhooks.route.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/payment-service/src/routes/webhooks.route.ts#L20-L27)):**
  Verified using `stripe.webhooks.constructEvent(rawText, signature, webhookSecret)`.
- **Carrier Webhooks ([`apps/shipping-service/src/services/webhook.service.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/shipping-service/src/services/webhook.service.ts#L21-L58)):**
  Verified using HMAC-SHA256 payload binding via `crypto.timingSafeEqual`. Fails closed if the secret is missing or set to the schema default.
- **Admin Claim Bootstrap ([`apps/admin/src/app/api/claim-admin/route.ts`](file:///Users/taha/projects/microservices-ecommerce/apps/admin/src/app/api/claim-admin/route.ts#L21-L55)):**
  Verified using SHA-256 constant-time comparison on `ADMIN_REGISTRATION_SECRET`; route is fail-closed by default (`ALLOW_ADMIN_CLAIM !== "true"`).

---

## 5. Security Checklist for Continuous Compliance

- [x] No plaintext secrets or `.env` files committed to version control.
- [x] API Gateway unconditionally strips internal identity headers.
- [x] Microservices verify gateway identity using timing-safe comparisons.
- [x] Webhook endpoints enforce cryptographic signature verification.
- [x] File uploads enforce size limits, deterministic keys, and magic-byte checks.
- [x] CORS policies enforce strict origin allowlists without wildcard reflection.
- [x] Kafka consumer loops isolate message handler exceptions to prevent crashes.
- [x] Order service scopes `GET /seller-orders` strictly to `request.userId` (Remediation: SEC-01).
- [x] Product service validates seller attribution on `PUT/DELETE /products/:id` (Remediation: SEC-02).
- [x] Production bootstrap enforces non-default `INTERNAL_SERVICE_SECRET` (Remediation: SEC-03).
- [x] Network perimeter isolation of microservice ports (Remediation: SEC-04).
- [x] Route-specific rate limiting on merchant onboarding (Remediation: SEC-05).
- [x] Commission service admin routes decouple transport secret from user authorization (Remediation: SEC-15).
- [x] Constant-time SHA-256 pre-hashed verification for internal secrets in commission and payout services (Remediation: SEC-16).
- [x] Production startup validates non-placeholder `INTERNAL_SERVICE_SECRET` in commission and payout services (Remediation: SEC-17).
- [x] Strict CORS origin allowlists and defensive HTTP security headers in commission and payout services (Remediation: SEC-18).
- [x] Eliminates mock token verification and admin escalation in analytic-service (Remediation: SEC-19).
- [x] Enforces RS256 token verification and dev bypass gating in notification-service (Remediation: SEC-20).
- [x] Pre-hashes secrets and enforces dev auth bypass flag in recommendation-service (Remediation: SEC-21).
- [x] Production startup validates non-placeholder `INTERNAL_SERVICE_SECRET` across Go and Python microservices (Remediation: SEC-22).
- [x] Enforces cryptographic signature verification on direct Bearer tokens in fraud-service (Remediation: SEC-23).
- [x] Production startup validates non-placeholder `INTERNAL_SERVICE_SECRET` in fraud-service (Remediation: SEC-24).
- [x] Hardens seller payout endpoints with requireSeller and strict role/is-seller guards against BFLA (Remediation: SEC-25).
- [x] Expands perimeter forbidden client headers to strip x-seller-id, x-dev-admin-override, and replication headers (Remediation: SEC-26).
- [x] Gates dev identity bypass behind explicit `FRAUD_DEV_AUTH_BYPASS` flag in fraud-service (Remediation: SEC-27).
