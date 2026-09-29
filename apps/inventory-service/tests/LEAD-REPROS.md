# Lead validation repros — security audit run-1

Executable validation plans for the two `needs_validation` leads from
`~/security-audit-skill/microservices-ecommerce/run-1/NEEDS-VALIDATION.md`.
Both leads are in-source complete; only the runtime/deployment observation
was missing at audit time.

## Lead 1 — admin-claim-admin-env-gate (FIXED)

**Original claim.** `POST /api/claim-admin` promoted any authenticated Clerk
user to `role: "admin"` whenever the admin app ran without explicit gates.

**Fix shipped (fail-closed env gate).** The route is now disabled unless
`ALLOW_ADMIN_CLAIM === "true"` AND `ADMIN_REGISTRATION_SECRET` is configured
(503 without the secret, constant-time compare). No NODE_ENV detection
exists — a missing env var can never enable self-promotion. See
`apps/admin/src/app/api/claim-admin/route.ts`.

**Post-fix verification steps.**

```bash
# Default (no env vars): must be rejected
curl -X POST http://localhost:3003/api/claim-admin
#   → 403 {"message":"Admin self-promotion is disabled."}

# Enabled but secret missing: must be refused
ALLOW_ADMIN_CLAIM=true pnpm --filter admin dev
curl -X POST http://localhost:3003/api/claim-admin
#   → 503 {"message":"ADMIN_REGISTRATION_SECRET must be configured..."}

# Enabled + secret set: only the correct header succeeds
ALLOW_ADMIN_CLAIM=true ADMIN_REGISTRATION_SECRET=<strong-secret> \
  pnpm --filter admin dev
curl -X POST http://localhost:3003/api/claim-admin
#   → 403 invalid/missing secret
curl -X POST http://localhost:3003/api/claim-admin \
  -H 'x-admin-claim-secret: <wrong-secret>'
#   → 403 invalid/missing secret
curl -X POST http://localhost:3003/api/claim-admin \
  -H 'x-admin-claim-secret: <strong-secret>'
#   → 401 not authenticated (no session) / 200 + role grant WITH a real
#     authenticated Clerk session
```

## Lead 2 — inventory-consumer-unverified-producer (FIXED)

**Original claim.** A `payment.successful` Kafka message whose payload
carries a known `referenceId` flipped a RESERVED inventory reservation to
CONFIRMED (sold) — the consumer never cross-checked the payment with
Stripe.

**Deeper fix shipped (Stripe paid-session cross-check).** The consumer now
verifies every `payment.successful` reference against Stripe itself and
confirms reservations only when Stripe reports `payment_status: "paid"`
(fail-closed on any lookup error). See
`apps/inventory-service/src/utils/stripe-verify.ts` and the guard in
`apps/inventory-service/src/workers/inventory-event.consumer.ts`. Rejections
are counted in the `inventory_payment_verification_rejected_total` metric.
Requires `STRIPE_SECRET_KEY` in inventory-service's env.

**Regression scripts.**

- Offline (no Stripe/network needed): `pnpm --filter inventory-service
test:stripe-verify` — asserts the forged lead payload is rejected before
  any confirm path runs, and that unknown `cs_` sessions fail closed.

- Live end-to-end (Docker + service running):
  `apps/inventory-service/tests/forged-payment-repro.ts`

```bash
# 1. Infrastructure (Docker daemon must be running)
docker compose -f packages/kafka/docker-compose.yml up -d

# 2. Inventory service (runs the payment.successful consumer)
pnpm --filter inventory-service dev

# 3. Forged message from an independent producer (uses the shared dev SCRAM
#    identity since the kafka-plaintext-noauth fix; before that fix no
#    credentials were needed at all)
pnpm --filter inventory-service exec tsx --env-file=.env \
  tests/forged-payment-repro.ts
```

**Expected result (post-fix):** `✓ FIX VERIFIED: reservation is still
RESERVED` — the consumer logs `Rejected payment.successful ... not a Stripe
checkout session id` and no stock changes hands. The script exits non-zero
if the reservation ever flips to CONFIRMED (regression alarm). It seeds its
own throwaway warehouse/item/reservation rows and cleans them up; it never
touches pre-existing data.

**Status on this machine:** live run pending (Docker daemon was not
running); the offline `test:stripe-verify` regression suite passes.
