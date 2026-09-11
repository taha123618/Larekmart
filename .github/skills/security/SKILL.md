---
name: security
description: Use when touching authentication, authorization, route guards, secrets/environment variables, Stripe webhooks, or any user-supplied input entering a service or database.
---

# Security

## Authentication & authorization (Clerk)

- Auth is delegated to **Clerk** in every workspace. Never build a custom auth system.
- Role lives in Clerk session claims: `sessionClaims.metadata.role` is `"user" | "admin"`
  (typed as `CustomJwtSessionClaims` in `@repo/types`).
- **Backend guards** (one per service, do not invent new names):
  - Express services: `shouldBeUser` / `shouldBeAdmin` middleware.
  - Fastify: `preHandler: shouldBeUser | shouldBeAdmin`.
  - Hono: `createMiddleware` variants in `apps/payment-service/src/middleware`.
- Status codes: `401` unauthenticated, `403` authenticated but not admin. Keep this
  contract when adding guards.
- **Admin UI gate:** `apps/admin/src/middleware.ts` protects everything except
  `/sign-in` and `/unauthorized` and redirects non-admins to `/unauthorized`. Frontend
  gating is UX only — the backend must still enforce authorization.

### Watch-outs

- `POST /products` in product-service is currently **not** guarded; if you touch product
  creation, review whether it should be admin-only and align with `PUT`/`DELETE`.
- Never trust a client-supplied `userId`; derive it from the verified session.

## Secrets & configuration

- Only `.env.example` files are committed. Real `.env` files are gitignored at the root
  and per app. **Never** commit a secret, key, or token.
- Read secrets from `process.env` only. Add new keys to the workspace `.env.example`
  with placeholder values.
- `NEXT_PUBLIC_*` variables are exposed to the browser — never put secrets there.
- Known hardcoded local values to be aware of (not production secrets): Kafka brokers
  `localhost:9094-9096` in `@repo/kafka`, and a Stripe **publishable** test key in
  `apps/client/src/components/StripePaymentForm.tsx`. Publishable keys are safe to
  expose, but prefer an env var when touching that file.

## Input validation

- Shared Zod schemas (`ProductFormSchema`, `CategoryFormSchema`, `UserFormSchema`,
  `shippingFormSchema`) live in `@repo/types` — reuse them rather than ad-hoc checks.
- Services still validate at the boundary; the current product controller double-checks
  `colors`/`images` even though the schema exists. Keep server-side validation.
- Use Prisma/Mongoose parameterized APIs; never build raw queries from strings.

## Payments

- Stripe webhook signatures **must** be verified with
  `stripe.webhooks.constructEvent(body, sig, webhookSecret)` (already done in
  `apps/payment-service/src/routes/webhooks.route.ts`). Never process an unverified
  webhook.
- Use raw request text for verification, not parsed JSON.
- Send amounts to Stripe in the smallest currency unit (cents); the code multiplies by
  `100` where appropriate.

## Boundaries

- A service may only access its own database through its `@repo/*-db` package.
- Do not return other users' data: scope queries by the session `userId`
  (e.g. `/user-orders` filters by `request.userId`).
