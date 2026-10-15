---
name: tax-engine
description: Use when authoring, modifying, testing, or debugging jurisdiction-aware tax calculations, versioned tax rules, customer exemptions, checkout tax quotes, calculation snapshots, or tax events in tax-service.
---

# Tax Engine & Compliance Playbook — tax-service

This playbook covers the authoritative standards and execution patterns for `apps/tax-service` (:8017).

## 1. Responsibilities & Boundaries

- **Authoritative Tax Store**: Owns `tax_jurisdictions`, `tax_categories`, `tax_rules`, `tax_exemptions`, `tax_calculations`, `tax_calculation_lines`, and `tax_provider_logs` in MySQL (`tax_db`) via Drizzle ORM.
- **Decimal Arithmetic Precision**: All financial calculations MUST use `decimal.js` with `ROUND_HALF_UP` rounding. Never use JavaScript floating-point numbers (`+`, `-`, `*`, `/`) for tax line math.
- **Auditable Calculation Snapshots**: Checkout calculation (`POST /api/v1/tax/calculate`) persists an immutable snapshot with foreign keys to line items and exact rule version applied. Quotes (`POST /api/v1/tax/quote`) calculate ephemeral previews without persistence.
- **Exemption Verification**: Validates certificate validity dates, jurisdiction scope, and customer identity before zero-rating eligible items.
- **Async Cross-Service Communication**:
  - Emits: `tax.calculation.completed`, `tax.calculation.failed`, `tax.rules.updated`, `tax.calculation.adjusted`.
  - Consumes: `order.created`, `product.tax-category.updated`, `tax.rules.updated`.

## 2. API Routes

| Method   | Path                                        | Auth           | Purpose                                                                 |
| :------- | :------------------------------------------ | :------------- | :---------------------------------------------------------------------- |
| `POST`   | `/api/v1/tax/quote`                         | Public         | Calculates ephemeral tax quote for cart/order items without persistence |
| `POST`   | `/api/v1/tax/calculate`                     | Public/User    | Calculates and persists an authoritative calculation snapshot for order |
| `GET`    | `/api/v1/tax/calculations/:calculationId`   | Public/User    | Retrieves historical calculation snapshot and line details              |
| `POST`   | `/api/v1/tax/returns/quote`                 | Public/User    | Calculates proportional tax adjustments for returned order lines        |
| `GET`    | `/api/v1/tax/jurisdictions`                 | Public         | Lists active jurisdictions (country, state, municipality)               |
| `GET`    | `/api/v1/tax/categories`                    | Public         | Lists tax categories (`STANDARD`, `REDUCED`, `ZERO`, `EXEMPT`)          |
| `GET`    | `/api/v1/admin/tax/overview`                | Admin          | Executive tax dashboard KPIs, active rules, snapshot counts             |
| `GET`    | `/api/v1/admin/tax/rules`                   | Admin          | Lists configurable versioned tax rules with filters                     |
| `POST`   | `/api/v1/admin/tax/rules`                   | Admin          | Creates new tax rule version                                            |
| `PATCH`  | `/api/v1/admin/tax/rules/:ruleId`           | Admin          | Modifies tax rule properties or rates                                   |
| `DELETE` | `/api/v1/admin/tax/rules/:ruleId`           | Admin          | Deletes inactive tax rule                                               |
| `POST`   | `/api/v1/admin/tax/rules/:ruleId/activate`  | Admin          | Activates tax rule and evicts Redis caches                              |
| `POST`   | `/api/v1/admin/tax/rules/:ruleId/deactivate`| Admin          | Deactivates tax rule and evicts Redis caches                            |
| `POST`   | `/api/v1/admin/tax/jurisdictions`           | Admin          | Registers a new jurisdiction                                            |
| `POST`   | `/api/v1/admin/tax/categories`              | Admin          | Registers a new product tax category                                    |
| `GET`    | `/api/v1/admin/tax/exemptions`              | Admin          | Lists customer exemption certificates                                   |
| `POST`   | `/api/v1/admin/tax/exemptions`              | Admin          | Grants customer exemption certificate                                   |
| `GET`    | `/api/v1/admin/tax/calculations`            | Admin          | Paginated calculation audit history                                     |
| `GET`    | `/health` / `/ready`                        | Public         | Health probes (MySQL + Redis connectivity)                              |
| `GET`    | `/metrics`                                  | Public         | Prometheus scrape endpoint                                              |

## 3. Testing & Verification

```bash
# Run unit and integration tests
pnpm --filter tax-service test

# Run static type checking
pnpm --filter tax-service check-types
```
