# Promotion Service Flash-Sale Concurrency & Reservation Hardening

## Overview
`promotion-service` is the centralized campaign, coupon, and discount calculation authority in Larekmart. It enforces promotional rules (minimum order amounts, category exclusions), campaign budgets, usage limits (`globalLimit`, `maxPerCustomer`), and checkout reservations (`RESERVED` -> `COMMITTED` / `RELEASED`).

### Identified Bottlenecks & Race Conditions
1. **Per-Customer Limit Circumvention**:
   - When a user submits rapid concurrent checkout clicks or scripts parallel reservation calls, `getCustomerUsageCount` checks prior redemptions and active reservations without locking.
   - Both concurrent calls observe `currentUses === 0 < maxPerCustomer`, allowing customers to bypass `maxPerCustomer` and obtain multiple unauthorized discount reservations.
2. **Flash-Sale Global Limit Oversubscription**:
   - `createReservation` evaluated `promo.rules.usageCount >= globalLimit`, but `usageCount` only tracks committed redemptions (`promotionRedemptions`), completely ignoring active in-flight reservations.
   - In a flash sale offering 50 discounts globally, 500 customers could successfully create reservations simultaneously because none had committed yet.
3. **Missing Distributed Idempotency Support**:
   - `POST /api/v1/promotions/reservations` and `POST /api/v1/promotions/reservations/:id/commit` lacked standard `Idempotency-Key` header support, exposing checkout flows to duplicate reservations on network retries.

## Target Architecture

### 1. Unified Global Limit & Active Reservation Tracking
- In `ReservationRepository.createReservation`, within the database transaction:
  - Acquire row-level lock on `promotionRules` using `FOR UPDATE`.
  - Calculate `totalReservedOrCommitted`:
    `activeReservations = count(promotion_reservations where promotion_id = ? and status = 'RESERVED' and expires_at > now())`
    `totalUsage = lockedRule.usageCount + activeReservations`
  - If `globalLimit != null && totalUsage >= globalLimit`, reject immediately with `"Promotion global usage limit reached"`.

### 2. Customer Concurrency Locking
- Acquire a Redis cluster lock or user-scoped mutex key (`promotions:lock:customer:${promoId}:${userId || guestId}`) during reservation creation.
- Ensure atomic evaluation of `getCustomerUsageCount` inside the locked execution boundary.

### 3. Distributed Idempotency Middleware (`idempotency.middleware.ts`)
- Implements Hono middleware utilizing `@repo/redis` `acquireIdempotencyLock`:
  - Enforces `Idempotency-Key` headers on state-mutating reservation and commit endpoints.
  - Transparently replays cached responses on repeated requests with `X-Idempotent-Replay: true`.
  - Rejects in-flight conflicts with HTTP 409 Conflict.

### 4. Verification & Safety
- Add comprehensive concurrency and idempotency tests in `tests/promotion-concurrency.test.ts`.
- Monorepo typecheck validation across all 41 packages.

