# Promotion Service

The **Promotion Service** is the centralized promotional campaign and discount engine for the Larekmart microservices platform. It supports Amazon-, AliExpress-, and Daraz-style marketplace campaigns, coupons, free-shipping offers, category/seller targeting, budget spending caps, and checkout reservations.

## Features

- **Campaign & Coupon Management**: Create, update, schedule, activate, and deactivate percentage, fixed-amount, and free-shipping promotions.
- **Granular Targeting**: Target by specific products, categories, sellers, or entire order, with support for exclusions.
- **Rule Engine**: Minimum order amounts, customer segments (`ALL`, `FIRST_TIME`, `VIP`), per-customer limits, and global campaign limits.
- **ACID Reservations & Budgets**: Prevents concurrent request overspend via PostgreSQL row-level locks and atomic transactions. Holds promotions during checkout and commits upon order completion.
- **Idempotency**: Repeated checkout reservation requests return the existing reservation without duplicate resource consumption.
- **Stacking & Priority**: Configurable stacking rules and priority order for multiple promotions.
- **Event-Driven Architecture**: Integrates via Apache Kafka for order lifecycle synchronization (`order.confirmed`, `order.cancelled`).
- **Telemetry & Observability**: OpenTelemetry standard Prometheus metrics (`/metrics`), health checks (`/health`, `/ready`), and structured Pino logging.

## Tech Stack

- **Runtime**: Node.js 22 LTS
- **Framework**: Hono 4 (`@hono/node-server`, `@hono/clerk-auth`)
- **Database**: PostgreSQL (`larekmart_promotion_db`) via Drizzle ORM
- **Cache**: Redis (`@repo/redis`)
- **Events**: Apache Kafka (`@repo/kafka`)
- **Validation**: Zod (`@repo/types`)
- **Port**: `8016`

## Running Locally

```bash
# Run migrations
pnpm --filter promotion-service db:migrate

# Start development server
pnpm --filter promotion-service dev

# Run test suite
pnpm --filter promotion-service test

# Type-check
pnpm --filter promotion-service check-types
```
