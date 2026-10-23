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
- **Internal Service Verification & API Gateway Perimeter**:
  - Direct HTTP calls between microservices are prohibited for business flows (use Kafka).
  - All public traffic enters through the centralized API Gateway (`apps/api-gateway`). The Gateway unconditionally strips client-supplied internal headers (`x-user-id`, `x-user-role`, `x-internal-secret`) to prevent identity spoofing.
  - The Gateway injects verified Clerk claims downstream (`x-user-id`, `x-user-role`) along with `x-internal-secret`.
  - Downstream services verify `x-internal-secret` against `INTERNAL_SERVICE_SECRET` using constant-time SHA-256 digest comparison (`safeTimingCompare` via `crypto.timingSafeEqual`).
  - Production deployments must fail startup if `INTERNAL_SERVICE_SECRET` equals the development placeholder.

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
  - In `apps/analytic-service`, dynamic ranges are strictly parameterized:
    ```sql
    -- SECURE
    SELECT ... WHERE date >= CURRENT_DATE - ($1 * INTERVAL '1 day')
    ```
  - Always validate, parse, and clamp numeric parameters (e.g., `Math.max(1, Math.min(365, parseInt(days, 10)))`).
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
  - **NEVER** use `origin: true` when `credentials: true` is enabled.
  - Always validate the incoming `Origin` against configured frontends (`CLIENT_URL`, `ADMIN_URL`):
    ```typescript
    const allowedOrigins = [
      process.env.CLIENT_URL || "http://localhost:3002",
      process.env.ADMIN_URL || "http://localhost:3003",
    ];
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

---

## 8. Definition of Done (Security Checklist)

Before merging any code changes:

- [ ] No unparameterized SQL or raw database string concatenations exist.
- [ ] Routes modifying or reading sensitive data check `userId` ownership or `admin` role.
- [ ] New public routes have appropriate rate limiting and input validation schemas.
- [ ] Webhook endpoints verify signatures in constant time.
- [ ] CORS policies use strict allowlists without wildcard origins when cookies/auth headers are present.
- [ ] File uploads validate size, MIME type, and safe storage destinations.
- [ ] `pnpm check-types` and automated security tests pass cleanly.
