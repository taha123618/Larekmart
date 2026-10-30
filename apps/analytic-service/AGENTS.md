# AGENTS.md — apps/analytic-service (analytics service & worker)

Scope: `apps/analytic-service` only. Root rules still apply — start there.

## What this service is

A high-throughput **Go 1.22** Kafka consumer worker and Chi HTTP API microservice running on port `8004`. It listens to 60+ event streams across the Larekmart platform (`payment.*`, `order.*`, `user.*`, `product.*`, `inventory.*`, `shipment.*`, `return.*`, `promotion.*`, `tax.*`, `dispute.*`, `vendor.*`, `seller.*`), updates lock-free in-memory atomic KPI counters, micro-batches raw audit events into PostgreSQL via binary `pgx.CopyFrom`, and serves sub-millisecond analytical queries to the Admin dashboard and Storefront trust indicators.

## Where things live

- `cmd/analytics/main.go` — Application bootstrap, Chi router wiring, HTTP listener on port `8004`, signal trapping (`SIGINT`/`SIGTERM`), and graceful shutdown draining.
- `internal/config/config.go` — Type-safe environment variable parsing with sensible development defaults.
- `internal/db/db.go` — `pgxpool.Pool` connection pool, embedded SQL migration runner, binary `pgx.CopyFrom` persistence, daily summary UPSERTs, and query helpers.
- `internal/cache/redis.go` — Redis client facade using `redis/go-redis/v9` with TTL caching and graceful fallback.
- `internal/metrics/store.go` — Lock-free in-memory KPI store (`sync/atomic` with CAS bit casting for float64 values) and fixed circular buffer for instant dashboard queries.
- `internal/ingestion/batcher.go` — High-velocity bounded channel queue buffer (10,000 capacity) with worker loop flushing on size (1,000 events) or timeout (500ms).
- `internal/ingestion/consumer.go` — Dedicated background Kafka consumer goroutine reading 60+ topics via `segmentio/kafka-go` without starving heartbeats.
- `internal/middleware/auth.go` — Zero-trust authentication verifying `X-Internal-Secret` in constant time (`crypto/subtle.ConstantTimeCompare`) and `X-User-Role: admin`, plus direct Bearer token verification.
- `internal/middleware/cors.go` & `logger.go` — Security headers, CORS configuration, and Prometheus HTTP request metrics middleware.
- `internal/handlers/analytics.go` — REST handlers for `/analytics/summary`, `/analytics/merchants`, `/analytics/operations`, `/analytics/commerce`, `/analytics/public`, `/analytics/daily-chart`, and `/analytics/events`.
- `internal/handlers/health.go` — Kubernetes probes (`/health`, `/health/live`, `/health/ready`) and `/metrics`.
- `internal/observability/metrics.go` — Prometheus counters and histograms.
- `internal/observability/logger.go` — Structured JSON logger matching monorepo conventions.
- `migrations/` — Embedded SQL migration files (`embed.FS`).

## Framework and Conventions

- **Go 1.22+** with `go-chi/chi/v5` router.
- No single-threaded event loop bottlenecks: Kafka reading, channel buffering, batch writing, and HTTP request handling execute concurrently across dedicated goroutines.
- Never allow `panic` in HTTP handlers or Kafka worker loops; recover and log structured errors.

## Kafka Integration

- Uses `segmentio/kafka-go`.
- Consumer group ID: `analytic-service-group`.
- Consumes 60+ platform topics across all 23 microservices.
- Dedicated reader goroutine ensures Kafka heartbeats (`session.timeout.ms`) are never blocked by heavy database writes or bursty traffic.
- Handlers extract payload from both `{ value: payload }` envelope and raw message payloads.

## Database & Persistence

- Connects to dedicated `postgres-analytics` on port `5433` (`analytics_db`).
- Uses `jackc/pgx/v5` connection pool (`pgxpool.Pool`).
- Employs binary COPY protocol (`pgx.CopyFrom`) for bulk insertion directly into monthly-partitioned `analytics_events` (`PARTITION BY RANGE (created_at)`).
- Block Range Indexes (BRIN) on `created_at` provide rapid range filtering and instant partition dropping for data retention.
- In-memory atomic counters continue operating even if PostgreSQL is temporarily unreachable.

## Caching

- Uses `redis/go-redis/v9`.
- Dashboard queries `/analytics/daily-chart` and `/analytics/events` are read-through cached with TTLs (`ANALYTICS_CHART_CACHE_TTL_SECONDS=60`, `ANALYTICS_EVENTS_CACHE_TTL_SECONDS=15`).
- Redis connection failures are non-fatal: queries fall through to PostgreSQL transparently.

## Verification

- Run unit & integration tests:
  ```bash
  go test -v ./...
  # or
  pnpm --filter analytic-service test
  ```
- Run static vetting:
  ```bash
  go vet ./...
  # or
  pnpm --filter analytic-service check-types
  ```
- Compile binary:
  ```bash
  go build -o bin/analytics ./cmd/analytics/main.go
  ```
