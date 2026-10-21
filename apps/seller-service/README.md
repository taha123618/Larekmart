# Larekmart Seller Service

Marketplace seller service managing storefront configuration, seller staff & delegated permissions, operational settings, performance metrics, and seller lifecycle state management.

## Port
- Default: `8021`

## Database
- PostgreSQL `seller_db` (or `larekmart_seller_db`) via Drizzle ORM

## Key Responsibilities
- Public storefront discovery: `GET /api/v1/storefronts/:slug`
- Storefront management: store name, slug, tagline, banner, logo, bio, vacation mode settings
- Seller staff & permissions: OWNER, MANAGER, CATALOG_SPECIALIST, FULFILLMENT_OPERATOR, CUSTOMER_SUPPORT
- Operational settings: default currency, auto-accept orders, shipping origin, low stock threshold
- Seller policies: shipping, returns, privacy, terms
- Performance snapshots: rating, fulfillment rate, cancellation rate, response times
- Publishes Kafka events: `seller.created`, `seller.activated`, `seller.updated`, `seller.suspended`, `seller.storefront.updated`
