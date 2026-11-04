# Deep Architectural Analysis & Testing Plan: Commission & Payout Services

**Scope:** `apps/commission-service` (:8022), `apps/payout-service` (:8023), Shared Contracts, Financial Ledger Invariants, and Cross-Service Event Integration

---

## 1. Executive Summary & Architecture Deep Dive

Larekmart's marketplace transformation introduces two high-criticality financial engines:

1. **`commission-service` (`:8022`)**: Fastify 5 + PostgreSQL + Drizzle ORM + Kafka + Decimal.js. Authoritative calculation of tiered marketplace fees, immutable rule version snapshots, and settlement quote breakdowns.
2. **`payout-service` (`:8023`)**: NestJS 11 on Fastify + PostgreSQL + Drizzle ORM + Kafka + Decimal.js. Authoritative settlement batches, balanced append-only double-entry ledger journal, dispute reserve holds, and external provider reconciliation (Bank ACH / Stripe Connect).

```
                                  ┌────────────────────────┐
                                  │   Clerk Auth / Gateway │
                                  └───────────┬────────────┘
                                              │ (x-internal-secret / JWT)
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         ┌─────────────────────────┐                     ┌─────────────────────────┐
         │   commission-service    │                     │     payout-service      │
         │         (:8022)         │                     │         (:8023)         │
         └────────────┬────────────┘                     └────────────┬────────────┘
                      │                                               │
             [Decimal.js Engine]                             [Double-Entry Ledger]
                      │                                               │
                      ▼                                               ▼
              PostgreSQL Drizzle                              PostgreSQL Drizzle
           (larekmart_commission_db)                        (larekmart_payout_db)
                      │                                               │
                      └───────────────┐               ┌───────────────┘
                                      ▼               ▼
                              ┌───────────────────────────────┐
                              │      Apache Kafka KRaft       │
                              │ commission.* / payout.* / ... │
                              └───────────────────────────────┘
```

---

## 2. Invariants & Financial Security Guarantees

### A. Commission Service Invariants

1. **Hierarchical Precedence**:
   Rule resolution follows a strict 4-tier hierarchy:
   $$\text{PRODUCT} > \text{SELLER} > \text{CATEGORY} > \text{GLOBAL} > \text{Fallback (8\%)}$$
   Active rules override lower tiers; inactive rules are bypassed.
2. **Zero Floating-Point Drift**:
   All fee calculations use `Decimal.js`. Standard IEEE 754 floating-point operations (`0.1 + 0.2 !== 0.3`) are strictly prohibited in the fee calculation path.
3. **Clamping & Ceiling Constraints**:
   - $\text{Fee} \ge \text{minCommission}$
   - $\text{Fee} \le \text{maxCommission}$
   - $\text{Fee} \ge 0$ (no negative fees)
   - $\text{Fee} \le \text{commissionableAmount}$ (commission can never exceed item total price)
4. **Historical Auditability & Rule Versioning**:
   Mutating a rule never overwrites historical fee agreements. Each modification creates an immutable `commission_rule_versions` record with incremented version number, locking past quotes to their respective versions.

### B. Payout Service Invariants

1. **Append-Only Double-Entry Journal**:
   There is **no mutable balance column**. Seller balances are calculated dynamically from immutable `ledger_entries`:
   $$\text{AvailableBalance} = \sum \text{Credits}_{\text{ESCROW}} - \sum \text{Debits}_{\text{ESCROW}} - \text{ActiveReserveHolds}$$
2. **Zero-Sum Ledger Balance ($\sum \text{Debit} == \sum \text{Credit}$)**:
   Every posted multi-leg transaction strictly enforces that total debits equal total credits. Any discrepancy aborts the transaction.
3. **Idempotency & Replay Protection**:
   Payout batches and provider dispatches enforce unique idempotency keys via `@repo/redis` atomic leases.
4. **Provider Authoritative Confirmation**:
   Payout records remain in `PROCESSING` until confirmed via provider callback webhook or batch reconciliation report.

---

## 3. Test Matrix & Coverage Scope

### A. Commission Service Test Suites

- **Suite 1: Hierarchical Precedence Resolution**:
  - Direct Product-level overrides.
  - Seller negotiated commission overrides.
  - Category baseline commission overrides.
  - Priority-based global rule resolution.
  - Inactive rule filtering and fallback to platform default (8%).
- **Suite 2: High-Precision Arithmetic & Clamping**:
  - Sub-cent / fractional paisa calculations.
  - Minimum fee clamping.
  - Maximum fee ceiling clamping.
  - Fee capped at item price (preventing 100%+ fee overflow).
  - Fixed-only, percentage-only, and composite fee rules.
- **Suite 3: Order-Level Grouping & Returns Adjustment**:
  - Multi-seller multi-item order quotes.
  - Proportional return adjustments.
  - Full cancellation reversals.
  - Negative adjustment prevention.
- **Suite 4: HTTP Routes, Zero-Trust Auth, & Fastify Injection**:
  - `/health`, `/ready`, `/metrics` probes.
  - `POST /api/v1/internal/commissions/quote` (constant-time internal secret gating).
  - `GET /api/v1/internal/commissions/orders/:orderId` (internal secret verification).
  - `GET /api/v1/admin/commissions/plans` (admin role check, 403 on non-admin).
  - `POST /api/v1/admin/commissions/plans` (plan creation).
  - `PATCH /api/v1/admin/commissions/rules/:ruleId` (version increment audit).
  - `GET /api/v1/admin/commissions/reports` (revenue reporting).

### B. Payout Service Test Suites

- **Suite 1: Double-Entry Ledger Mathematical Invariants**:
  - Balanced 2-leg transactions ($\Delta = 0.00$).
  - Unbalanced transactions rejection ($\sum \text{Debits} \ne \sum \text{Credits}$).
  - Negative transaction leg amounts rejection.
  - Complex 3-leg split transactions (Buyer Debit = Escrow Credit + Platform Commission Credit).
  - Multi-currency ledger account separation (PKR vs USD vs EUR).
- **Suite 2: Dynamic Ledger Balance Derivation**:
  - Escrow earnings aggregation.
  - Dispute reserve hold deduction.
  - Reserve hold exceeding escrow (clamped to 0.00, non-negative).
  - Disbursed payouts escrow clearing debit.
- **Suite 3: Payout Provider Adapter & Idempotency**:
  - MockBankAdapter disburse verification.
  - Idempotency key tracking.
  - Provider callback reconciliation.
- **Suite 4: NestJS HTTP Server & Route Guards**:
  - `/health`, `/ready`, `/metrics` probes.
  - `POST /api/v1/internal/payouts/schedule` (internal secret gating).
  - `POST /api/v1/internal/payouts/reconcile` (internal secret gating).
  - `GET /api/v1/admin/payouts` (admin role check).
  - `POST /api/v1/admin/payouts/:payoutId/retry` (admin role check).
  - `GET /api/v1/sellers/me/balance` (authenticated seller balance).
  - `GET /api/v1/sellers/me/payouts` (seller payouts list).
  - `GET /api/v1/sellers/me/statements` (monthly statements).
- **Suite 5: Kafka Consumer Event Handlers**:
  - `commission.accrued` -> ledger escrow crediting.
  - `order.delivered` -> settlement maturity unlock.
  - `seller.suspended` -> account payout hold imposition.
  - `seller.activated` -> account payout hold release.
