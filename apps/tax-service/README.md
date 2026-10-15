# @repo/tax-service

High-performance jurisdiction-aware tax calculation, versioned tax rules, customer exemption certificates, checkout tax quotes, historical audit snapshots, and replaceable provider adapter pattern for the Larekmart platform.

## Architecture

- **Runtime**: Node.js 22 LTS
- **Framework**: Fastify 5
- **Database**: MySQL 8.0 (`tax_db`) managed with Drizzle ORM
- **Cache**: Redis (`@repo/redis`) with namespace `tax:v1:*`
- **Event Bus**: Apache Kafka (`@repo/kafka`)
- **Authentication**: Clerk JWT & API Gateway Internal Secret Delegation (`@repo/types`)
- **Default Port**: `8017`

## Features

1. **Jurisdiction-Aware Rule Engine**:
   - Resolves tax rules across hierarchical jurisdiction scopes (country, state/region, municipality/postal code).
   - Dynamic product category tax mappings with default fallbacks (`STANDARD`, `REDUCED`, `ZERO`, `EXEMPT`).
   - Supports both inclusive and exclusive sales tax, VAT, and GST.
2. **Decimal Precision Arithmetic**:
   - Implements `decimal.js` with `ROUND_HALF_UP` bankers rounding across all calculation lines.
   - Eliminates JavaScript IEEE-754 binary floating-point rounding inaccuracies.
3. **Auditable Calculation Snapshots**:
   - Persists immutable calculation records (`tax_calculations` and `tax_calculation_lines`) bound to order IDs.
   - Preserves rule versions and rates at checkout time for regulatory audit compliance.
4. **Proportional Refund Adjustments**:
   - Calculates exact proportional tax reversals on order return and line cancellations (`POST /api/v1/tax/returns/quote`).
5. **Customer Tax Exemptions**:
   - Validates government or non-profit exemption certificates (`RESALE`, `GOVERNMENT`, `EDUCATIONAL`, `NON_PROFIT`).
6. **Replaceable Provider Adapter Pattern**:
   - Clean `ITaxProviderAdapter` abstraction supporting local standard calculation engine or external tax compliance APIs (e.g. Avalara / TaxJar).
7. **Kafka Event Synchronization**:
   - Publishes `tax.calculation.completed`, `tax.calculation.failed`, `tax.rules.updated`, and `tax.calculation.adjusted`.
   - Consumes `order.created`, `product.tax-category.updated`, and rule cache eviction events.

## Commands

```bash
# Development server
pnpm --filter tax-service dev

# Type check
pnpm --filter tax-service check-types

# Run tests
pnpm --filter tax-service test

# Database migrations
pnpm --filter tax-service db:migrate

# Seed tax rules and jurisdictions
pnpm --filter tax-service db:seed
```
