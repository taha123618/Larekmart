# Analytic Service (`apps/analytic-service`)

High-throughput, multithreaded Go analytics microservice and worker that consumes project-wide Kafka event streams to aggregate real-time metrics, track business KPIs (revenue, orders, user signups, product catalog updates, merchant activity), persist structured audit logs via PostgreSQL binary `COPY` protocol, and serve analytical queries to the Admin dashboard.

## Architecture & Design Highlights

1. **Decoupled Kafka Ingestion**:
   - Written in **Go 1.22** using `segmentio/kafka-go`.
   - Ingestion is fully decoupled from processing: a dedicated reader goroutine consumes 60+ platform topics across all 23 microservices and immediately deposits events into a thread-safe, bounded channel queue buffer (10,000 capacity).
   - Kafka heartbeat loops run uninterrupted in their own goroutine, completely eliminating event-loop starvation, heartbeat timeouts (`session.timeout.ms`), and catastrophic consumer group rebalance storms under peak flash-sale loads.

2. **Binary COPY Micro-Batching (`pgx.CopyFrom`)**:
   - A dedicated worker pool drains the bounded buffer and persists events in micro-batches (up to 1,000 events or 500ms flush window) using PostgreSQL's native binary COPY protocol (`pgx.CopyFrom`).
   - Bypasses SQL query parsing, tokenization, and query planning overhead, delivering 5–10x higher write throughput than standard multi-row `INSERT` statements.

3. **Time-Partitioned Storage & Columnar Analytics Engine**:
   - Primary analytical data resides in **ClickHouse** (port `8123` HTTP / `9000` TCP) utilizing `ReplacingMergeTree` columnar storage with `toYYYYMM` partitioning and native Kafka streaming engine (`ENGINE = Kafka`) with materialized views for **0% compute overhead on backend nodes**.
   - PostgreSQL 16 (`analytics_events` table) acts as dual-path transactional analytical storage, partitioned by month (`PARTITION BY RANGE (created_at)`) with Block Range Indexes (BRIN).

4. **Lock-Free In-Memory Atomic Counters**:
   - Real-time KPI summaries (`/analytics/summary`, `/analytics/merchants`) query lock-free atomic counters (`sync/atomic` with CAS bit casting for float64 revenue and tax metrics) for instant `<1ms` response times.

5. **Read-Through Redis Caching**:
   - Time-series and event feed endpoints (`/analytics/daily-chart`, `/analytics/events`) leverage `redis/go-redis/v9` TTL caching (60s / 15s) with graceful fallback to PostgreSQL if Redis is unavailable.

6. **Zero-Trust Perimeter Authentication**:
   - Validates `X-Internal-Secret` in constant time (`crypto/subtle.ConstantTimeCompare`) alongside `X-User-Role: admin` forwarded by the API Gateway.
   - Supports direct Bearer Clerk JWT verification with fail-closed production semantics.

---

## Tech Stack

- **Runtime**: Go 1.22+
- **HTTP Router**: `go-chi/chi/v5`
- **Port**: `8004`
- **Primary Columnar Database**: ClickHouse 24.8+ (`clickhouse:8123` HTTP / `9000` Native) with native Kafka engine streaming
- **Relational Fallback Database**: PostgreSQL 16 (Dedicated `postgres-analytics` on port `5433` / `analytics_db`) via `jackc/pgx/v5` (`pgxpool.Pool`)
- **Messaging**: Apache Kafka (`segmentio/kafka-go`)
- **Cache**: Redis 7 (`redis/go-redis/v9`)
- **Telemetry**: Prometheus (`prometheus/client_golang`)

---

## HTTP API Endpoints

| Method | Path                     | Auth Required                            | Description                                                                    |
| :----- | :----------------------- | :--------------------------------------- | :----------------------------------------------------------------------------- |
| `GET`  | `/health`                | Public                                   | Detailed health status of service, DB, and Redis                               |
| `GET`  | `/health/live`           | Public                                   | Kubernetes liveness probe                                                      |
| `GET`  | `/health/ready`          | Public                                   | Kubernetes readiness probe                                                     |
| `GET`  | `/metrics`               | Public / Scraper                         | Prometheus metrics endpoint                                                    |
| `GET`  | `/analytics/public`      | Public Storefront                        | Safe platform scale proof (active sellers, verified vendors, fulfillment rate) |
| `GET`  | `/analytics/summary`     | Admin (`X-Internal-Secret` / Bearer JWT) | High-level platform KPIs (revenue, orders, signups, products)                  |
| `GET`  | `/analytics/merchants`   | Admin (`X-Internal-Secret` / Bearer JWT) | Multi-vendor merchant KPIs (total, active, pending, revenue)                   |
| `GET`  | `/analytics/operations`  | Admin (`X-Internal-Secret` / Bearer JWT) | Fulfillment, shipping, inventory, returns, and dispute telemetry               |
| `GET`  | `/analytics/commerce`    | Admin (`X-Internal-Secret` / Bearer JWT) | Financial, tax collections, promotion savings, and cart telemetry              |
| `GET`  | `/analytics/daily-chart` | Admin (`X-Internal-Secret` / Bearer JWT) | Time-series daily revenue, orders, and signups (Redis cached 60s)              |
| `GET`  | `/analytics/events`      | Admin (`X-Internal-Secret` / Bearer JWT) | Recent audit event stream (Redis cached 15s)                                   |

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
PORT=8004
DATABASE_URL="postgresql://postgres:password123@localhost:5433/analytics_db"
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=analytics:v1:
ANALYTICS_CHART_CACHE_TTL_SECONDS=60
ANALYTICS_EVENTS_CACHE_TTL_SECONDS=15
KAFKA_BROKERS=localhost:9094,localhost:9095,localhost:9096
CLIENT_URL=http://localhost:3002
ADMIN_URL=http://localhost:3003
INTERNAL_SERVICE_SECRET=dev-shared-internal-secret-larekmart
```

---

## Development & Verification Commands

```bash
# Run standalone dev server
pnpm --filter analytic-service dev
# or: go run ./cmd/analytics/main.go

# Run unit & integration test suites
pnpm --filter analytic-service test
# or: go test -v ./...

# Static type and vetting check
pnpm --filter analytic-service check-types
# or: go vet ./...

# Build binary
pnpm --filter analytic-service build
# or: go build -o bin/analytics ./cmd/analytics/main.go
```
