# @repo/e2e — Shared End-to-End Test Suite

This package provides browser-level automated end-to-end (E2E) testing for Larekmart across Chromium, Firefox, and WebKit using [Playwright](https://playwright.dev/).

## Structure

```text
packages/e2e/
├── src/
│   └── index.ts              # Exported test fixtures & assertions for apps
├── tests/
│   ├── cart-persistence.spec.ts    # Guest cart preservation across reloads & sessions
│   ├── customer-checkout.spec.ts   # End-to-end checkout flow with Stripe test card
│   ├── product-search.spec.ts      # Product discovery, category filtering & navigation
│   └── seller-order-view.spec.ts   # Seller dashboard authentication & order table
├── playwright.config.ts      # Multi-project browser matrix & dev web server config
└── package.json              # Workspace package manifest
```

## Running Tests

From the monorepo root:

```bash
# Run all E2E tests
pnpm e2e

# Run tests via package filter
pnpm --filter @repo/e2e test

# Run tests in headed mode with UI
pnpm --filter @repo/e2e test:ui

# List all discovered tests
pnpm --filter @repo/e2e exec playwright test --list
```

## Environment Variables

See `.env.example` in this package for configuration options:

| Variable | Default | Purpose |
|---|---|---|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3002` | Customer Storefront target URL |
| `E2E_ADMIN_URL` | `http://localhost:3003` | Admin Dashboard target URL |
| `E2E_SELLER_URL` | `http://localhost:3004` | Seller & Merchant Dashboard target URL |
| `SELLER_TEST_EMAIL` | *(optional)* | Test seller account email |
| `SELLER_TEST_PASSWORD` | *(optional)* | Test seller account password |

## Exported Utilities (`@repo/e2e`)

Consumer applications (`apps/client`, `apps/admin`, `apps/seller`) can import shared test helpers from `@repo/e2e`:

```typescript
import { fillStripePayment, assertCartCount, TEST_CONFIG } from "@repo/e2e";
```
