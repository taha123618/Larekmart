# Distributed Order Saga & Automated Stock Compensation

**Status**: APPROVED & IN PROGRESS  
**Date**: November 2026  
**Scope**: `apps/inventory-service`, `apps/payment-service`, `apps/order-service`, `@repo/types`, `docs/EVENT-DRIVEN-ARCHITECTURE.md`

---

## 1. Context & Architectural Bottleneck

During checkout, inventory is secured through the Asynchronous Fast-Claim Engine (`apps/inventory-service`) via an atomic Redis Lua lease and persisted reservation in PostgreSQL.

### The Bottlenecks & Gaps

1. **Unreturned Redis Stock on Order Cancellation**:
   - When `order.cancelled` events were received by `inventory-service`, reservations were released in PostgreSQL, but `redisStockGatekeeper.incrementStockCounter()` was omitted. This caused phantom stock exhaustion in Redis where flash-sale items appeared sold out despite available PostgreSQL inventory.
2. **Missing Payment Failure & Session Expiration Recovery**:
   - `apps/payment-service` only handled `checkout.session.completed` webhooks. If a customer abandoned checkout (triggering Stripe `checkout.session.expired`) or card authentication failed (triggering `payment_intent.payment_failed`), no domain event was emitted to Kafka.
   - Consequently, reserved stock remained locked until late TTL sweepers expired, preventing eager stock re-allocation to active buyers.

---

## 2. Shared Architecture & Invariants

```
Stripe Webhook
[checkout.session.expired / payment_failed]
                  │
                  ▼
payment-service (POST /webhooks/stripe)
  • Verifies Stripe signature in constant time
  • Emits 'payment.failed' event with reservationId & sessionId
                  │
                  ▼
              Kafka Topic: 'payment.failed'
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
inventory-service       order-service
  • Releases Postgres     • Transitions order to 'failed'
    reservation           • Triggers compensation audit log
  • Increments Redis
    Stock Gatekeeper
  • Flushes cache
```

### Invariants:

1. **Zero Phantom Depletion**: Every reservation release in PostgreSQL (`order.cancelled`, `payment.failed`, `inventory.reservation.cancelled`) strictly increments the corresponding Redis Stock Gatekeeper counter via atomic `INCREMENT_LUA`.
2. **Eager Expiration Compensation**: Stripe `checkout.session.expired` and `payment_intent.payment_failed` webhooks immediately release reserved stock rather than waiting for passive TTL expirations.
3. **Idempotent Saga Rollbacks**: Multiple rollback triggers for the same `referenceId` or `reservationId` are idempotent (`releaseReservationsByReference` returns empty array if already released).
4. **Attestation & Security**: Payment webhook handling verifies signatures with Stripe SDK using the raw request payload.

---

## 3. Implementation Steps

1. **Contracts (`@repo/types`)**:
   - Define and export `PaymentFailedPayload` in `packages/types/src/order.ts` and `index.ts`.
2. **Payment Service (`apps/payment-service`)**:
   - Handle `checkout.session.expired` and `payment_intent.payment_failed` in `src/routes/webhooks.route.ts` and dispatch `payment.failed`.
3. **Inventory Service (`apps/inventory-service`)**:
   - Fix `order.cancelled` handler in `inventory-event.consumer.ts` to increment `redisStockGatekeeper`.
   - Add `payment.failed` topic handler in `inventory-event.consumer.ts` releasing reservations and refunding Redis stock counters.
4. **Order Service (`apps/order-service`)**:
   - Ensure `payment.failed` subscription handles order compensation.
5. **Testing & Verification**:
   - Verify with unit tests in `inventory-service` and `payment-service`.
   - Update `docs/plans/README.md`, `docs/EVENT-DRIVEN-ARCHITECTURE.md`, `AGENTS.md`, and skills.
