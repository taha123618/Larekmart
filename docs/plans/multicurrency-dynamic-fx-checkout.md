# Architectural Plan: Multi-Currency Dynamic FX & Storefront Checkout

## Executive Summary

This feature delivers an enterprise-grade multi-currency experience across the **Larekmart** platform (Amazon/AliExpress standard). Shoppers can browse, calculate cart totals, and complete Stripe checkout in their preferred regional currency (`USD`, `PKR`, `EUR`, `GBP`, `AED`, `SAR`). The engine implements floating exchange rates with Redis caching (1-hour TTL), psychological price rounding (e.g. `$19.99`, `PKR 5,500`), and passes dynamic currency contexts to `payment-service` so Stripe checkout sessions charge in the customer's selected currency while locking an immutable FX snapshot for multi-vendor settlement.

---

## 1. Scope & System Architecture

```
[Storefront Customer (apps/client)]
       │
       ├─► Selects Currency (USD, PKR, EUR, GBP, AED, SAR)
       ├─► Prices rendered via useCurrencyStore with Psychological Rounding
       ├─► Submits Cart Checkout with selected currency & FX rate
       ▼
[API Gateway (apps/api-gateway)]
       │
       ▼
[Payment Service (apps/payment-service)]
       │
       ├─► Validates CreateCheckoutSessionSchema (with target currency)
       ├─► Generates multi-currency Stripe Checkout Session
       ├─► Attaches immutable FX metadata (baseAmount, targetCurrency, exchangeRate)
       ▼
[Stripe Multi-Currency Checkout]
       │
       ▼ (Webhook: checkout.session.completed)
[Order Service (apps/order-service)]
       │
       ▼
Locks immutable currency & exchangeRate in Order model for settlement
```

---

## 2. Detailed Technical Plan (360° Feature Delivery Standard)

### Stage 1: Domain Contracts & Types (`packages/types`)

- Updated `CreateCheckoutSessionSchema` in `packages/types/src/index.ts`:
  - `currency`: `z.string().length(3).default("USD")`
  - `exchangeRate`: `z.number().positive().optional()`
- Enhanced `packages/types/src/pricing.ts`:
  - Added `PsychologicalRoundingRule` and `CurrencyConversionOptions` schema.
  - Defined `SupportedCurrencyEnum` (`USD`, `PKR`, `EUR`, `GBP`, `AED`, `SAR`).
  - Added `RefreshCurrencyRatesResponseSchema`.

### Stage 2: Pricing Service Dynamic FX & Rounding (`apps/pricing-service`)

- Enhanced `apps/pricing-service/src/engine/currency.ts`:
  - Implemented psychological price rounding:
    - USD / EUR / GBP / CAD: Round cents to `.99` or `.95`.
    - PKR / JPY: Round to nearest whole 10 or 100 (e.g. `PKR 5,490` or `5,500`).
    - AED / SAR: Round to `.00` or `.50`.
- Enhanced `apps/pricing-service/src/services/pricing.service.ts`:
  - Added Redis caching layer (`@repo/redis`) with 1-hour TTL (`KEY: "pricing:fx_rates:usd"`).
  - Added automated fallback to database and default base rates if external feed or cache is momentarily unavailable.
  - Added admin manual/scheduled refresh endpoint: `POST /api/v1/admin/prices/currencies/refresh`.

### Stage 3: Multi-Currency Stripe Checkout (`apps/payment-service`)

- Updated `apps/payment-service/src/routes/session.route.ts`:
  - Extract requested `currency` and `exchangeRate` from verified request body.
  - Calculate `line_items[].price_data.currency` matching requested currency.
  - Correctly scale `unit_amount` according to Stripe's currency decimal rules (e.g., USD/EUR/GBP/AED/SAR have 2 decimal places [cents], zero-decimal currencies have 0).
  - Inject metadata into the Stripe session: `target_currency`, `fx_rate`, `base_currency_total`.

### Stage 4: Storefront Client Integration (`apps/client`)

- Upgraded `apps/client/src/stores/currencyStore.ts`:
  - Support psychological rounding algorithm in `convertPrice()` and `formatPrice()`.
  - Add currency symbol positions (prefix vs suffix, e.g. `$19.99` vs `19.99 €` vs `₨ 5,500`).
- Updated `apps/client/src/app/cart/page.tsx`:
  - When calling `createCheckoutSession`, pass the active `currentCurrency` and `exchangeRate` from `useCurrencyStore`.
- Updated `apps/client/src/components/CurrencySelector.tsx`:
  - Enhanced UX with quick-select pills and live rate refresh indicators.

### Stage 5: Admin FX & Currency Management (`apps/admin`)

- Updated `apps/admin/src/app/(dashboard)/pricing/page.tsx`:
  - Added a dedicated "Currencies & Exchange Rates" management tab.
  - Display live exchange rates table, active status, last refreshed timestamps.
  - Provide "Refresh FX Rates" button to invoke `POST /api/v1/admin/prices/currencies/refresh`.

### Stage 6: Testing & Quality Gates

- **Unit & Integration Tests**:
  - `apps/pricing-service/tests/currency-conversion.test.ts`: Test floating conversion math, psychological rounding rules, and Redis caching.
  - `apps/payment-service/tests/payment-service.test.ts`: Verify multi-currency Stripe session creation across USD, EUR, GBP, and PKR.
- **Verification Gates**:
  - `pnpm check-types` across monorepo.
  - `pnpm test` across monorepo.
  - `pnpm --filter client --filter admin build`.
  - `pnpm lint` and `pnpm format`.
