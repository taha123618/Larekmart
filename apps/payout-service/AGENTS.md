# AGENTS.md — Payout Service

## 1. Overview
The **Payout Service** (`apps/payout-service`) is a NestJS 11 + Fastify microservice running on port **8023**. It is responsible for seller payout schedules, settlement batches, double-entry balanced ledger management, dispute reserve holds, and external payout provider (bank ACH / Stripe Connect) reconciliation.

## 2. Invariants & Financial Invariants
1. **Append-Only Double-Entry Journal**: Balances are calculated dynamically from `ledger_entries` (`SUM(credits) - SUM(debits)`). A mutable column is never treated as the authoritative financial source of truth.
2. **Debits Equal Credits**: Every transaction posted to the ledger must balance to $0.00 difference across accounts.
3. **Provider Authoritative Confirmation**: Payouts remain in `PROCESSING` until the payment provider webhook or reconciliation batch confirms settlement.
4. **Idempotency Enforcement**: All payout creation and batch runs enforce unique idempotency keys.
5. **Universal PgBouncer Compatibility**: Database connection parameters enforce `statement_cache_size=0`.
6. **Zero-Trust Perimeter**: `/api/v1/internal/*` routes require constant-time verification of `x-internal-secret`. Admin routes require `x-user-role === "admin"`.

## 3. Database Tables
- `payout_accounts`
- `payouts`
- `payout_batches`
- `settlements`
- `ledger_accounts`
- `ledger_entries`
- `payout_adjustments`
- `payout_provider_events`

## 4. Key Commands
```bash
pnpm --filter payout-service check-types  # Static type check
pnpm --filter payout-service test         # Run unit & security integration tests
pnpm --filter payout-service dev          # Start local dev server
```
