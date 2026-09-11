---
name: event-metrics
description: Use when adding new KPI aggregations, modifying database queries, or updating metric calculation schemas in apps/analytic-service.
---

# Event Metrics & Persistence Workflows

Guidance for calculating, aggregating, and persisting analytics metrics in `apps/analytic-service`.

## 1. Metrics & Data Models

`analytic-service` maintains two levels of analytical state:

1. **Raw Event Log (`analytics_events`)**: Individual transaction and lifecycle event records with `event_type`, `user_id`, `amount`, `metadata` (JSONB), and `created_at`.
2. **Daily Rollup Aggregations (`analytics_daily_summary`)**: Daily counters (`total_revenue`, `total_orders`, `total_signups`, `total_products_created`).
3. **In-Memory Snapshot**: Real-time counters available for live observation and log heartbeats.

## 2. PostgreSQL Connection Pattern

- Connection managed via `pg.Pool` initialized from `DATABASE_URL`.
- Auto-initialization executes `CREATE TABLE IF NOT EXISTS` upon worker startup in `src/db.ts`.
- Uses parameterized queries (`$1, $2, ...`) and `ON CONFLICT (date) DO UPDATE` for idempotent rollups.

## 3. Adding a New Metric Event

When introducing a new event to track:

1. Ensure the payload type is defined in `@repo/types`.
2. Add a recording function in `src/services/metrics.service.ts` updating in-memory counters and executing DB inserts.
3. Register the topic in `src/index.ts` under `consumer.subscribe([...])`.
4. Update `apps/analytic-service/README.md` and `docs/EVENT-DRIVEN-ARCHITECTURE.md`.

## 4. Verification

```bash
pnpm --filter analytic-service check-types
```
