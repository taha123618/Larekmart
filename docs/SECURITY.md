# Security Architecture & Policies

Security architecture, authentication standards, and data protection guidelines across Larekmart.

## 1. Authentication & Authorization (Clerk)

- Identity management is delegated to **Clerk** across all frontends and services.
- **Session Claims**: Role metadata is stored in `sessionClaims.metadata.role` (`"user" | "admin"`), defined as `CustomJwtSessionClaims` in `@repo/types`.
- **Backend Route Protection**:
  - Express (`product-service`, `auth-service`): `shouldBeUser` / `shouldBeAdmin` middleware.
  - Fastify (`order-service`): `preHandler: shouldBeUser | shouldBeAdmin`.
  - Hono (`payment-service`): `shouldBeUser` / `shouldBeAdmin` middleware via `@hono/clerk-auth`.
- **Admin UI Gating**: `apps/admin/src/middleware.ts` routes non-admins to `/unauthorized`. Frontend gating is defense-in-depth; all mutating operations are authorized on the backend.

## 2. Secrets & Environment Management

- **Zero Committed Secrets**: Only `.env.example` files are tracked in version control. All real `.env` files are gitignored globally and per workspace.
- **Client vs Server Boundary**: Only variables prefixed with `NEXT_PUBLIC_` may be exposed to the browser. API keys (e.g. `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `DATABASE_URL`, `MONGO_URL`) must never have `NEXT_PUBLIC_` prefixes.

## 3. Payment Security (Stripe)

- Webhook events (`POST /webhooks/stripe`) **must** be verified using `stripe.webhooks.constructEvent()` against the raw request text and `STRIPE_WEBHOOK_SECRET`.
- Sensitive credit card information is processed directly by Stripe Elements; card details never touch Larekmart application servers.

## 4. Input Validation & Data Sanitation

- All user-supplied mutation inputs are validated against shared Zod schemas (`ProductFormSchema`, `CategoryFormSchema`, `UserFormSchema`, `shippingFormSchema`).
- Database queries use parameterized ORM/ODM APIs (Prisma, Mongoose) to prevent SQL or NoSQL injection vulnerabilities.
- User-scoped queries always filter by `session.userId` derived directly from verified JWT claims.
