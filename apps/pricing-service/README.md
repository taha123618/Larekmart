# Pricing Service (`apps/pricing-service`)

Authoritative merchandise pricing microservice for Larekmart. Built with Fastify 5, TypeScript, Drizzle ORM, PostgreSQL, Redis, Kafka, and Decimal.js.

## Core Responsibilities

- **Base & Variant Prices**: Manages product base prices, seller price lists, and variant overrides.
- **Volume Tiers & Rules**: Calculates bulk discounts, tiered quantity pricing, and customer-group rules (B2B vs B2C).
- **Multi-Currency Pricing**: Converts prices with Decimal.js based on configured exchange rate policies.
- **Authoritative Price Quotes**: Provides consistent, immutable price snapshots to cart, checkout, and order workflows.
- **Promotion Quote Composition**: Combines base merchandise pricing with promotional discount quotes from `promotion-service`.
- **Negative Price Prevention**: Strictly prevents negative or unauthorized pricing adjustments.
- **Audit History**: Tracks price change history, change reasons, and actor identification.

## Port & Endpoints

- Default Port: `8019`
- Public / Client:
  - `GET /api/v1/prices/products/:productId`
  - `POST /api/v1/prices/quote`
  - `POST /api/v1/prices/bulk-quote`
- Admin:
  - `POST /api/v1/admin/price-lists`
  - `POST /api/v1/admin/prices`
  - `PATCH /api/v1/admin/prices/:priceId`
  - `GET /api/v1/admin/prices/:priceId/history`
- Health:
  - `GET /health`
  - `GET /ready`
  - `GET /api/v1/prices/health`
  - `GET /metrics`
