# Security Policy

The Larekmart team takes the security of our microservices e-commerce platform and our users' data seriously. This document outlines our vulnerability disclosure policy, security architecture principles, and secure development standards.

---

## 1. Reporting a Vulnerability

If you discover a security vulnerability in Larekmart, please report it privately rather than opening a public issue on GitHub.

- **Email**: security@larekmart.local (or your designated security contact)
- **Response SLA**: We acknowledge receipt of reports within 24–48 hours.
- **Triage & Remediation**: Critical issues are triaged immediately, and patches are developed and tested within 72 hours.
- **Coordinated Disclosure**: We ask security researchers to allow sufficient time for remediation before any public disclosure.

Please include:

- A clear description of the vulnerability.
- Step-by-step reproduction instructions or a minimal proof of concept.
- The affected service(s), endpoints, or packages.
- Impact assessment (e.g., potential unauthorized data access, privilege escalation).

---

## 2. Security Architecture Principles

### Zero Trust Across Services

- Direct service-to-service HTTP requests for business actions are prohibited; services communicate asynchronously via Kafka topics.
- Where HTTP routes accept internal infrastructure traffic (e.g., internal notification routing), they require an explicit internal service secret (`X-Internal-Secret`).

### Centralized Authentication (Clerk)

- Identity verification is strictly delegated to Clerk across storefront and admin applications.
- Tokens and session claims are cryptographically verified by backend middleware before executing any controller logic.
- Roles (`admin` vs. `user`) are stored in verified JWT claims (`sessionClaims.metadata.role`).
- The admin privilege claim route (`/api/claim-admin`) is permanently disabled in production and secured with `ADMIN_REGISTRATION_SECRET` in development.

### Broken Object-Level Authorization (IDOR) Protection

- All endpoints returning or modifying user resources (e.g., `/orders/:id`, `/carts`) verify that the resource `userId` matches the authenticated `request.userId` from Clerk, unless the caller holds a verified `admin` role.

### Parameterized Database Queries

- Database queries across PostgreSQL and MongoDB must use parameterized APIs or typed ORM methods (Prisma / Mongoose).
- Raw SQL query string interpolation (e.g. `WHERE date >= ... ${days}`) is strictly prohibited. Dynamic dates and ranges must be bound as positional parameters (`$1`).

### Cryptography & Timing Attacks

- Webhook signatures from external vendors (e.g., Stripe, shipping carriers) must be verified in constant time using `crypto.timingSafeEqual` or official SDK verification helpers (`stripe.webhooks.constructEvent`).

### Strict CORS & HTTP Security Headers

- API gateways and backend services must never configure `origin: true` when credentials are permitted. An explicit allowlist of authorized origins (`CLIENT_URL`, `ADMIN_URL`) is enforced.
- All web applications emit standard defensive headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### File Upload & Malware Mitigation

- Uploads are restricted by strict MIME type allowlists (`image/jpeg`, `image/png`, `image/webp`) and a maximum file size limit (5MB).
- Uploaded assets are handled by managed object storage (e.g., Cloudinary) using server-generated UUIDs, preventing file execution in local application environments.

---

## 3. Developer Security Checklist

Before committing or submitting a Pull Request:

1. **Types & Boundaries**: Run `pnpm check-types` across all packages.
2. **Access Control**: Ensure newly added endpoints require authentication (`shouldBeUser` or `shouldBeAdmin`).
3. **No Secrets**: Verify that no API keys, private certificates, or `.env` files are tracked in Git.
4. **Validation**: Ensure all input payloads are validated with Zod schemas from `@repo/types`.
