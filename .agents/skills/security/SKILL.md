---
name: security
description: Use when touching authentication, authorization, route guards, secrets/environment variables, Stripe webhooks, or any user-supplied input entering a service or database.
---

# Security Standards & Guidelines

This document specifies the mandatory cybersecurity standards and implementation patterns across all Larekmart frontends, microservices, and shared packages.

---

## 1. Authentication & Authorization (Clerk & RBAC)

- **Authentication is delegated to Clerk**: Never hand-roll authentication.
- **Roles in Clerk Claims**: `sessionClaims.metadata.role` is `"user" | "admin"` (typed as `CustomJwtSessionClaims` in `@repo/types`).
- **Backend Guards (by framework)**:
  - **Express**: Use `shouldBeUser` or `shouldBeAdmin` middleware.
  - **Fastify**: Use `preHandler: shouldBeUser | shouldBeAdmin`.
  - **Hono**: Use `createMiddleware` in `apps/payment-service/src/middleware` or `apps/inventory-service`.
  - **Koa**: Use `requireAdminOrInternal` in `apps/shipping-service/src/middleware/auth.middleware.ts`.
- **Status Codes**: Return `401 Unauthorized` for missing/invalid tokens, and `403 Forbidden` for authenticated requests lacking admin privileges.
- **Admin Privilege Escalation Protection**:
  - The `/api/claim-admin` endpoint in `apps/admin` is fail-closed: disabled unless `ALLOW_ADMIN_CLAIM === "true"` AND `ADMIN_REGISTRATION_SECRET` is set. Do not reintroduce NODE_ENV-based gating — a missing env var must never enable self-promotion.
  - When enabled, every request requires the `x-admin-claim-secret` header, compared in constant time against `ADMIN_REGISTRATION_SECRET`.
  - Admin UI route middleware (`apps/admin/src/middleware.ts`) strictly requires `sessionClaims?.metadata?.role === "admin"`.
- **Internal Service Verification**:
  - Direct HTTP calls between microservices are prohibited for business flows (use Kafka).
  - For infrastructure or notification relay endpoints accepting internal traffic (e.g. `notification-service`), identity headers like `X-User-ID` are only trusted if accompanied by `X-Internal-Secret` matching `INTERNAL_SERVICE_SECRET`.

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
  - Administrative endpoints (e.g. `GET /admin/stats`, `GET /admin/recent` in `cart-service`) must be gated with `requireAdmin`.

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

- **Validation at Client & Server Boundaries**:
  - **MIME Type Allowlist**: Strictly limit uploads to safe image types: `image/jpeg`, `image/png`, `image/webp`.
  - **File Size Restrictions**: Cap uploads to a strict maximum (e.g., 5MB).
  - **Storage Isolation**: Do not write uploads to local executable directories. Use managed object storage (e.g. Cloudinary, S3) with server-generated UUIDs for asset naming.
  - **Executable Prevention**: Never accept `.exe`, `.sh`, `.php`, `.js`, `.svg` (without SVG sanitization), or double-extension files (`image.jpg.exe`).

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
