---
name: security
description: Use when touching authentication, authorization, route guards, secrets/environment variables, Stripe webhooks, or any user-supplied input entering a service or database.
---

# Security Standards & Guidelines

This document specifies the mandatory cybersecurity standards and implementation patterns across all Larekmart frontends, microservices, and shared packages.

---

## 1. Authentication & Authorization (Clerk & RBAC)

- **Authentication is delegated to Clerk**: Never hand-roll authentication.
- **Roles in Clerk Claims**: `sessionClaims.metadata.role` is `"user" | "seller" | "admin"` (typed as `CustomJwtSessionClaims` in `@repo/types`).
- **Backend Guards (by framework)**:
  - **Express**: Use `shouldBeUser`, `shouldBeAdmin`, or `shouldBeSellerOrAdmin` (e.g. `apps/product-service`).
  - **Fastify**: Use `preHandler: shouldBeUser | shouldBeAdmin`, or `requireSellerStaffOrAdmin` (`apps/seller-service`).
  - **Hono**: Use `createMiddleware` in `apps/payment-service/src/middleware` or `apps/inventory-service`.
  - **Koa**: Use `requireAdminOrInternal` in `apps/shipping-service/src/middleware/auth.middleware.ts`.
- **Status Codes**: Return `401 Unauthorized` for missing/invalid tokens, and `403 Forbidden` for authenticated requests lacking necessary privileges.
- **Admin Privilege Escalation Protection**:
  - The `/api/claim-admin` endpoint in `apps/admin` is fail-closed: disabled unless `ALLOW_ADMIN_CLAIM === "true"` AND `ADMIN_REGISTRATION_SECRET` is set. Do not reintroduce NODE_ENV-based gating — a missing env var must never enable self-promotion.
  - When enabled, every request requires the `x-admin-claim-secret` header, compared in constant time against `ADMIN_REGISTRATION_SECRET`.
  - Admin UI route middleware (`apps/admin/src/middleware.ts`) strictly requires `sessionClaims?.metadata?.role === "admin"`.
- **Super Admin Governance & Delegated Administration**:
  - Global platform controls (`PATCH /api/v1/admin/system-settings` for `isSellerEnabled`) and delegation management (`POST/DELETE /api/v1/admin/delegations`) are strictly restricted to Super Administrators (`role === "super_admin"` or `claims.isSuperAdmin === true`).
  - Manage Admins can be granted the `manage_sellers` delegation scope in `admin_delegations`. When present, `api-gateway` injects `x-user-can-manage-sellers: true` downstream, authorizing them to review vendors and update seller statuses without granting global Super Admin privileges.
- **Internal Service Verification & API Gateway Perimeter**:
  - Direct HTTP calls between microservices are prohibited for business flows (use Kafka).
  - All public traffic enters through the centralized API Gateway (`apps/api-gateway`). The Gateway unconditionally strips client-supplied internal headers (`x-user-id`, `x-user-role`, `x-internal-secret`, `x-user-is-seller`, `x-user-is-super-admin`, `x-user-can-manage-sellers`) _prior_ to injecting upstream headers to prevent identity spoofing and header injection.
  - The Gateway injects verified Clerk claims downstream (`x-user-id`, `x-user-role`, `x-user-is-seller`, `x-user-is-super-admin`, `x-user-can-manage-sellers`) along with `x-internal-secret`.
  - Downstream services verify `x-internal-secret` against `INTERNAL_SERVICE_SECRET` using constant-time SHA-256 digest comparison (`safeTimingCompare` via `crypto.timingSafeEqual`).
  - **Decoupling Gateway Authenticity from User Authorization**: An internal service secret validates that the request originated from the trusted API Gateway; it **must never** automatically grant administrative permissions to a regular user. Administrative routes must verify `role === "admin"`, `role === "super_admin"`, or `isSuperAdmin`.
  - **Fail-Closed Direct JWT Verification**: Services accepting direct Bearer tokens (shipping, returns, notification WebSockets) must verify Clerk's **RS256** signature against `CLERK_JWT_KEY` (PEM public key/certificate) and enforce `exp` (and `nbf` when present). Decoding a base64url payload without verifying the signature is strictly forbidden and must fail closed (HTTP 401/403) when keys are missing or invalid.
  - **Never use `CLERK_SECRET_KEY` as an HMAC key.** Clerk session tokens are RS256, not HS256, signed with that secret. Symmetric verification is only permitted through an explicit `CLERK_JWT_HMAC_KEY` fixture for tests/local harnesses — never a production default.
  - **Go services**: `analytic-service` and `notification-service` must use the shared `verifyClerkToken` pattern (RS256 + `exp`/`nbf`), reject non-RS256 `alg`, and fail closed when `CLERK_JWT_KEY` is absent. Identity from `X-User-ID`/`?user_id=` is local-dev only and requires an explicit `*_DEV_AUTH_BYPASS=true` flag.
  - **Python services**: `recommendation-service` must not decode unverified JWTs or HMAC with the Clerk secret. Identity arrives via verified gateway headers; local `X-User-ID` bypass requires `RECOMMENDATION_DEV_AUTH_BYPASS=true` and a non-production `APP_ENV`.
  - Production deployments must fail startup if `INTERNAL_SERVICE_SECRET` equals the development placeholder. `validateInternalServiceSecret` rejects placeholder/change-me/example/dummy values.
  - **Gateway rate limiting**: key on verified `authUserId`, then a SHA-256 hash of the bearer token, then the trusted client IP. Never trust a client-supplied `x-user-id`/`X-Forwarded-For` directly. Set `TRUST_PROXY` to the real hop count (`false` when directly exposed, `1` behind a trusted ingress).

---

## 2. Broken Object-Level Authorization (IDOR Prevention)

- **Mandatory Ownership Checks**:
  - Never allow a user to read, update, or delete resources belonging to another user simply by specifying an ID.
  - In `order-service`, `GET /orders/:id` verifies:
    ```typescript
    if (order.userId !== request.userId && request.userRole !== "admin") {
      return reply
        .status(403)
        .send({ message: "Forbidden: You do not have access to this order" });
    }
    ```
  - In `cart-service`, operations must strictly bind to the authenticated `userId` from the verified session or an unguessable guest session UUID.
  - In `seller-service`, operations on `/api/v1/sellers/:sellerId` strictly verify that the caller is the seller primary user, an authorized staff member with required granular permissions, or an admin.
  - Administrative endpoints (e.g. `GET /admin/stats`, `GET /admin/recent` in `cart-service`, `GET /api/v1/admin/sellers` in `seller-service`) must be gated with `requireAdmin`.

---

## 3. SQL Injection Prevention & Database Security

- **Parameterized Queries Everywhere**:
  - Never concatenate user-supplied input into raw SQL queries or strings.
  - In `apps/analytic-service`, dynamic ranges in Go `pgxpool.Pool` queries are strictly parameterized:
    ```sql
    -- SECURE
    SELECT ... WHERE date >= CURRENT_DATE - ($1 * INTERVAL '1 day')
    ```
  - Always validate, parse, and clamp numeric parameters (e.g., `daysInt := min(max(1, days), 365)`).
- **ORM / Query Builder Safety**:
  - Use Prisma and Mongoose typed client methods (`findUnique`, `update`, `create`).
  - Do not use raw `$where` clauses in Mongoose or unparameterized `$queryRawUnsafe` in Prisma.

---

## 4. Cryptography & Timing-Safe Verification

- **Carrier & Webhook Verification**:
  - Webhook signatures (e.g., shipping carrier tracking updates) MUST be validated using constant-time comparison to prevent timing attacks:

    ```typescript
    import crypto from "node:crypto";

    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const incomingBuf = Buffer.from(incomingSignature, "utf8");
    if (
      expectedBuf.length !== incomingBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, incomingBuf)
    ) {
      throw new Error("Invalid signature");
    }
    ```

- **Stripe Webhooks**:
  - Always verify signatures using `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)` in `payment-service`.
  - Pass the raw request buffer/text, never pre-parsed JSON.

---

## 5. File Uploads & Malware Protection

- **Validation at Client & Server Boundaries (`media-service`)**:
  - **Presigned Upload Architecture**: Clients upload directly to S3/MinIO via presigned PUT URLs with short TTLs. Binary payloads never buffer on application servers.
  - **Magic-Byte Signature Inspection**: Verify file contents using actual magic bytes (`MAGIC_BYTES` for JPEG, PNG, WebP, AVIF, PDF) before finalizing uploads to prevent MIME-confusion attacks.
  - **Path Traversal Sanitization**: `sanitizeFilename` strips directory traversal sequences (`../`), null bytes, and shell metacharacters. Object keys use deterministic server-generated UUID paths.
  - **Category-Based Size Limits**: Enforce strict caps by category (`avatar`, `product-image`, `seller-document`).
  - **Quarantine Workflow**: Invalid or failed files are quarantined (`QUARANTINED` status) and trigger audit events.

---

## 6. CORS & Security Headers

- **Strict CORS Origin Allowlist**:
  - **NEVER** use `origin: true` or `origin: "*"` when `credentials: true` is enabled.
  - Always validate the incoming `Origin` against configured frontends (`CORS_ORIGIN`, `CLIENT_URL`, `ADMIN_URL`). The shared helper `resolveCorsOrigins` in `@repo/types` centralizes this; use it for Fastify/Hono CORS callbacks rather than hardcoding wildcards:
    ```typescript
    import { resolveCorsOrigins } from "@repo/types";

    const allowedOrigins = resolveCorsOrigins(
      process.env.CORS_ORIGIN ||
        `${process.env.CLIENT_URL || "http://localhost:3002"},${process.env.ADMIN_URL || "http://localhost:3003"}`,
    );
    ```
- **HTTP Security Headers**:
  - Ensure all Next.js applications and API services emit standard security headers:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `X-XSS-Protection: 1; mode=block`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## 7. Secrets & Environment Configuration

- Only `.env.example` files are committed. Real `.env*` files are strictly gitignored.
- Never commit secrets, API keys, or private certificates.
- `NEXT_PUBLIC_*` variables are exposed to client-side bundles; never place backend secrets in public env variables.
- Secrets must be loaded via `process.env` or centralized secret managers in staging/production.
- `infrastructure/kubernetes/base/secrets/secret-templates.yaml` is an **External Secrets
  template, not a deployable secret**. Values are `__REQUIRED_EXTERNAL_SECRET__`; the real
  Secret is projected by the external-secrets operator. Never replace the placeholders with
  working defaults.
- Production `NODE_ENV`/`APP_ENV` must be set explicitly (`production`) so startup
  validation and dev-bypass gates actually engage. Setting only one of them is not enough
  for Go services that check both.

---

## 8. Definition of Done (Security Checklist)

Before merging any code changes:

- [ ] No unparameterized SQL or raw database string concatenations exist.
- [ ] Routes modifying or reading sensitive data check `userId` ownership or `admin` role.
- [ ] New public routes have appropriate rate limiting and input validation schemas.
- [ ] Rate-limit keys never depend on client-supplied identity/forwarding headers.
- [ ] Webhook endpoints verify signatures in constant time.
- [ ] Direct Bearer tokens are RS256-verified (`CLERK_JWT_KEY`) with `exp`/`nbf`; the
      Clerk secret key is never used as an HMAC key.
- [ ] Development identity bypasses require explicit opt-in env flags and are off in production.
- [ ] CORS policies use strict allowlists without wildcard origins when cookies/auth headers are present.
- [ ] File uploads validate size, MIME type, and safe storage destinations.
- [ ] `pnpm check-types` and automated security tests (`shipping`, `seller`, `vendor`,
      `notification`/`analytic` Go tests, `recommendation` pytest) pass cleanly.
