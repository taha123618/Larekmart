---
name: event-metrics
description: Use when adding new KPI aggregations, modifying database queries, or updating metric calculation schemas in apps/analytic-service.
---

# Event Metrics & Persistence Workflows

Guidance for calculating, aggregating, and persisting analytics metrics in `apps/analytic-service`.

## 1. Metrics & Data Models

`analytic-service` maintains three layers of analytical state:

1. **In-Memory Lock-Free Atomic KPI Store (`internal/metrics/store.go`)**:
   - `sync/atomic` counters with CAS float64 bit-casting for instant `<1ms` telemetry (`GetSummary()`, `GetOperationsMetrics()`, `GetCommerceMetrics()`, `GetPublicTrustMetrics()`).
   - Circular buffer for in-memory recent event streams.
2. **Raw Partitioned Event Log (`analytics_events`)**:
   - Time-partitioned PostgreSQL table (`PARTITION BY RANGE (created_at)`) with Block Range Indexes (BRIN).
   - Ingested via native binary COPY protocol (`pgx.CopyFrom`).
3. **Daily Aggregation Rollups (`analytics_daily_summary`)**:
   - Upserted daily counters (`total_revenue`, `total_orders`, `total_signups`, `total_products_created`).
   - Served via `/analytics/daily-chart` with Redis read-through caching (60s TTL).

## 2. PostgreSQL Connection Pattern

- Managed via `pgxpool.Pool` (`internal/db/db.go`) connecting to dedicated `postgres-analytics:5432/analytics_db` (or port 5433 locally).
- Embedded SQL migrations using Go `embed.FS` (`migrations/001_init.sql`).
- Bulk ingestion via `pgx.CopyFrom` bypasses SQL statement parsing and tokenization overhead, executing micro-batches in `<5ms`.

## 3. Adding a New Metric Event

When introducing a new event to track:

1. Define the event contract and schemas in `@repo/types/src/analytics.ts`.
2. Add topic subscription in `apps/analytic-service/internal/ingestion/consumer.go` (`SubscribedTopics`).
3. Update `apps/analytic-service/internal/metrics/store.go` with atomic counter fields and mutation logic in `RecordEvent()`.
4. Expose the metric in `internal/handlers/analytics.go` and corresponding models in `internal/models/metrics.go`.
5. Update unit tests in `internal/metrics/store_test.go` and `internal/handlers/analytics_test.go`.

## 4. Verification

```bash
# Run unit & concurrency tests
pnpm --filter analytic-service test
# or: go test -v ./...

# Run static vetting check
pnpm --filter analytic-service check-types
# or: go vet ./cmd/... ./internal/...
```
