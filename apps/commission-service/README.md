# Larekmart Commission Service

Centralized marketplace commission and fee engine managing commission plans, versioned tiered fee rules, order item fee calculations, return/refund adjustments, and publisher of commission settlement obligations.

---

## 1. Overview & Architecture

- **Port**: `8022` (via API Gateway `:8080`)
- **Runtime**: Node.js 22 + TypeScript + Fastify 5
- **ORM / Database**: Drizzle ORM + PostgreSQL (`larekmart_commission_db`)
- **Caching**: Redis namespace `commission:v1:*`
- **Event Bus**: Apache Kafka via `@repo/kafka`
- **Precision Arithmetic**: `decimal.js` for arbitrary-precision currency and fee calculations
- **Authentication**: Zero-Trust internal secret (`x-internal-secret`) and Clerk admin session claims

---

## 2. Database Schema

Six relational tables persisted in PostgreSQL via Drizzle ORM:

| Table                      | Purpose                                                                                               |
| :------------------------- | :---------------------------------------------------------------------------------------------------- |
| `commission_plans`         | Top-level commission plans (Default Marketplace, VIP Sellers, Category Tiers).                        |
| `commission_rules`         | Granular rules (percentage fee, fixed fee, min/max limits) scoped to seller, category, or product.    |
| `commission_rule_versions` | Immutable snapshots of fee rules guaranteeing historical settlements cannot be retroactively altered. |
| `commission_calculations`  | Order-level fee snapshots with total commission, gross amount, currency, and net payable.             |
| `commission_line_items`    | Item-level fee breakdowns linking each product item to the exact rule version applied.                |
| `commission_adjustments`   | Adjustments recorded when order returns, partial refunds, or cancellations occur.                     |

---

## 3. API Endpoints

### Internal Services (`requireInternalSecret`)

- `POST /api/v1/internal/commissions/quote` — Real-time quote evaluation for cart preview or checkout fee breakdown.
- `GET /api/v1/internal/commissions/orders/:orderId` — Retrieve itemized fee calculations for an order.

### Administration (`requireAdmin`)

- `GET /api/v1/admin/commissions/plans` — List all marketplace commission plans and rules.
- `POST /api/v1/admin/commissions/plans` — Create new commission plan with tiered rules.
- `PATCH /api/v1/admin/commissions/rules/:ruleId` — Update rule parameters (auto-increments rule version).
- `GET /api/v1/admin/commissions/reports` — Generate platform commission revenue and breakdown reports.

---

## 4. Kafka Event Streams

### Published Events

- `commission.calculated` — Emitted when quotes or order calculations are produced.
- `commission.accrued` — Emitted when an order payment succeeds, establishing settlement obligations.
- `commission.adjusted` — Emitted when returns require partial fee adjustments.
- `commission.reversed` — Emitted when full cancellations or chargebacks reverse fees.

### Consumed Events

- `order.created` — Pre-computes commission calculations for incoming orders.
- `payment.successful` — Authoritatively accrues commission liabilities.
- `order.cancelled` — Reverses accrued commission.
- `return.inspected` — Computes return adjustments.
- `seller.created` — Binds default marketplace plan to newly onboarded sellers.

---

## 5. Development & Testing

```bash
# Run migrations
pnpm --filter commission-service db:migrate

# Run tests
pnpm --filter commission-service test

# Static type check
pnpm --filter commission-service check-types
```
