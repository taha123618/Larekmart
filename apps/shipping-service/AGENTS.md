# shipping-service AGENTS.md

Instructions for agents editing `apps/shipping-service`.

## 1. Responsibilities

- `shipping-service` owns: shipping methods, rates, shipments, packages, carrier integrations, tracking history, labels, and carrier webhooks.
- Does **NOT** own orders, payments, cart, or user accounts.

## 2. Architecture & Rules

- Koa application on port **8011**.
- Carrier logic belongs in `src/providers/`, implementing `ShippingProvider`. Never place carrier-specific SDK calls directly in controllers.
- Use PostgreSQL via `@repo/shipping-db` as the source of truth.
- Use Redis via `@repo/redis` solely for caching and webhook idempotency.
- Use Kafka via `@repo/kafka` for asynchronous cross-service events. Always use `{ value: payload }` envelope.
- Standard error responses must be JSON: `{ message: string }`.
- Authentication via `requireAdminOrInternal`: requires valid `x-internal-secret` (verified with `safeTimingCompare`) or cryptographically verified Clerk Bearer token with `role === "admin"`. If forwarded by gateway on behalf of a user (`x-user-role`), non-admin users are rejected with 403. In production, missing signing keys must fail-closed (401).

## 3. Commands

```bash
pnpm --filter shipping-service dev
pnpm --filter shipping-service check-types
pnpm --filter shipping-service test
```
