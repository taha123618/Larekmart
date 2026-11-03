# Larekmart Payout Service

Financially critical seller payout and settlement engine managing seller payout accounts, automated settlement batches, a balanced append-only double-entry ledger, dispute reserve holds, and external payout provider (bank ACH / Stripe Connect) reconciliation.

---

## 1. Overview & Architecture

- **Port**: `8023` (via API Gateway `:8080`)
- **Runtime**: Node.js 22 + TypeScript + NestJS 11 on Fastify
- **ORM / Database**: Drizzle ORM + PostgreSQL (`larekmart_payout_db`)
- **Caching**: Redis namespace `payout:v1:*`
- **Event Bus**: Apache Kafka via `@repo/kafka`
- **Precision Arithmetic**: `decimal.js` for arbitrary-precision financial ledger mathematics
- **Authentication**: Zero-Trust internal secret (`x-internal-secret`), Clerk user session claims, and admin role gates

---

## 2. Invariants & Financial Guarantees

1. **Balanced Double-Entry Journal**: Balances are calculated dynamically by aggregating immutable `ledger_entries` (`SUM(credits) - SUM(debits)`). A mutable column is never treated as the authoritative financial source of truth.
2. **Debit Equals Credit Invariant**: Every posted financial transaction strictly enforces `SUM(debit) == SUM(credit)` zero-sum across accounts.
3. **Provider Authoritative Confirmation**: Payout records remain in `PROCESSING` until confirmed via provider callback or reconciliation batch.
4. **Idempotency Leases**: Payout creations, batch schedules, and retry dispatches enforce distributed idempotency keys via `@repo/redis`.
5. **Universal PgBouncer Compatibility**: Normalized connection URLs enforce `statement_cache_size=0`.

---

## 3. Database Schema

Eight relational tables persisted in PostgreSQL via Drizzle ORM:

| Table                    | Purpose                                                                                                     |
| :----------------------- | :---------------------------------------------------------------------------------------------------------- |
| `payout_accounts`        | Seller banking and payout destination profiles (Stripe Connect account, Bank IBAN/ACH).                     |
| `payouts`                | Individual payout disbursement records with status tracking and provider reference.                         |
| `payout_batches`         | Scheduled settlement batches grouping disbursements by currency and cutoff date.                            |
| `settlements`            | Seller settlement period summaries linking sales volume, fees, returns, and net payouts.                    |
| `ledger_accounts`        | Chart of accounts (`ESCROW`, `PENDING_SETTLEMENT`, `AVAILABLE_PAYOUT`, `RESERVE_HOLD`, `PLATFORM_REVENUE`). |
| `ledger_entries`         | Append-only double-entry debits and credits representing authoritative money movements.                     |
| `payout_adjustments`     | Manual or automated adjustments (chargebacks, fee refunds, dispute reserves).                               |
| `payout_provider_events` | Immutable log of provider webhook payloads and reconciliation receipts.                                     |

---

## 4. API Endpoints

### Seller Operations (`requireUser`)

- `GET /api/v1/sellers/me/payouts` — Paginated history of disbursements for the authenticated seller.
- `GET /api/v1/sellers/me/balance` — Real-time ledger balance (available, pending, escrow, reserve hold).
- `GET /api/v1/sellers/me/statements` — Historical monthly settlement statements and breakdowns.

### Internal Operations (`requireInternalSecret`)

- `POST /api/v1/internal/payouts/schedule` — Trigger settlement batch generation for matured escrow orders.
- `POST /api/v1/internal/payouts/reconcile` — Match and reconcile provider clearing reports.

### Admin Operations (`requireAdmin`)

- `GET /api/v1/admin/payouts` — Search, filter, and inspect platform-wide payouts and batches.
- `POST /api/v1/admin/payouts/:payoutId/retry` — Retry failed payouts after resolving destination bank errors.

---

## 5. Kafka Event Streams

### Published Events

- `payout.scheduled` — Emitted when a batch schedules a disbursement.
- `payout.processing` — Emitted when payout instructions are submitted to the provider.
- `payout.completed` — Emitted when provider confirms successful fund settlement.
- `payout.failed` — Emitted when provider rejects or fails a transfer.
- `payout.reconciled` — Emitted when a settlement batch has completed reconciliation.

### Consumed Events

- `commission.accrued` — Records commission credit to platform revenue ledger.
- `order.delivered` — Releases escrow holds to available payout balance upon fulfillment maturity.
- `payment.successful` — Credits merchant escrow ledger after buyer payment capture.
- `return.refunded` — Debits escrow or pending balance for customer refunds.
- `seller.suspended` — Imposes emergency payout hold across pending balances.
- `seller.activated` — Releases holds once account status returns to good standing.

---

## 6. Development & Testing

```bash
# Run migrations
pnpm --filter payout-service db:migrate

# Run tests
pnpm --filter payout-service test

# Static type check
pnpm --filter payout-service check-types
```
