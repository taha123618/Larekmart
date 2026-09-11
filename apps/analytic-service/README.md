# Analytic Service (`apps/analytic-service`)

Hybrid analytics worker and HTTP API service that consumes project-wide Kafka event streams to aggregate real-time metrics, track business KPIs (revenue, orders, user signups, product catalog changes), persist structured audit event logs, and serve analytical queries to the Admin dashboard.

## Tech Stack

- **Runtime & Web Framework**: Node.js (ESM), Express 5
- **Port**: `8004`
- **Authentication**: `@clerk/express` (Admin-gated queries)
- **Messaging**: Apache Kafka (`@repo/kafka`)
- **Shared Types**: `@repo/types`
- **Persistence**: PostgreSQL (`pg` connection pool with auto-initialization and resilient in-memory aggregation fallback)

## Event Integrations

The analytic service subscribes to all core event streams emitted across Larekmart microservices:

- **`payment.successful`**: Emitted by `payment-service` upon Stripe webhook confirmation. Aggregates revenue, items sold, and customer checkout activity.
- **`order.created`**: Emitted by `payment-service` / `order-service` when a customer order is placed and finalized.
- **`user.created`**: Emitted by `auth-service` upon Clerk user signups. Tracks user registration metrics.
- **`product.created`**: Emitted by `product-service` upon product addition. Tracks catalog growth.
- **`product.deleted`**: Emitted by `product-service` upon product deletion.

## HTTP API Endpoints

| Method | Path                     | Auth Required           | Description                                                        |
| :----- | :----------------------- | :---------------------- | :----------------------------------------------------------------- |
| `GET`  | `/health`                | Public                  | Returns service uptime and status                                  |
| `GET`  | `/analytics/summary`     | Admin (`shouldBeAdmin`) | Returns overall platform KPIs (`AnalyticsSummaryType`)             |
| `GET`  | `/analytics/daily-chart` | Admin (`shouldBeAdmin`) | Returns daily aggregations over time (`AnalyticsDailyChartType[]`) |
| `GET`  | `/analytics/events`      | Admin (`shouldBeAdmin`) | Returns latest audit event stream (`AnalyticsEventType[]`)         |

## Schema & Tables

When PostgreSQL is connected, the service automatically ensures the following tables exist:

1. `analytics_events`: Raw audit log of events with user, amount, and JSONB metadata.
2. `analytics_daily_summary`: Daily rollups of revenue, orders, signups, and catalog modifications.

If PostgreSQL is temporarily unavailable, the service logs events to console, maintains real-time in-memory counters with heartbeat reporting, and continues serving cached metrics without crashing the consumer group.

## Environment Variables

Copy `.env.example` to `.env`:

```env
PORT=8004
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ecommerce"
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Development Commands

```bash
# Run standalone
pnpm --filter analytic-service dev

# Type check
pnpm --filter analytic-service check-types
```
