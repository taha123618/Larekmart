# Notification Service (`apps/notification-service`)

A high-throughput, production-grade **Go (1.22+)** microservice providing a unified multi-channel notification platform for Email, SMS (Twilio), Push, and In-App (WebSockets) delivery across the **Larekmart** e-commerce microservices platform.

---

## 1. Architecture Overview

The `notification-service` is built with a lightweight, provider-agnostic architecture:

```text
Node.js Services (auth, order, payment, product)
       │
       ▼
     Kafka (user.created, order.created, payment.successful, notification.dispatch)
       │
       ▼
┌───────────────────────────────────────────────────────────────┐
│   Go Notification Service (:8005)                             │
│                                                               │
│   • Chi HTTP Router                                           │
│   • Multi-Topic Kafka Consumer Manager                        │
│   • Redis Fast Deduplication & PostgreSQL Idempotency         │
│   • User Preference Evaluation & Template Engine              │
│   • Native Go Worker Pools (Email, SMS, Push, In-App)         │
│   • Real-Time In-App WebSocket Hub                            │
│   • OpenTelemetry Distributed Tracing & Prometheus Metrics    │
└───────────────────────────────────────────────────────────────┘
       │
   ┌───┼──────────┬──────────┐
   ▼   ▼          ▼          ▼
 Email SMS       Push      In-App
                   │         │
                 FCM/APNS  WebSocket
```

---

## 2. Key Features

- **Multi-Channel Orchestration**: Unified lifecycle management for Email, SMS (Twilio API), Push, and In-App notifications.
- **Provider-Agnostic Channel Abstraction**: Clean `Channel` interface with pluggable providers (Twilio, FCM, APNS, Mock).
- **Email Service Synergy**: Coordinates email notifications and delegates heavy email transport to `email-service` via Kafka (`email.dispatch`).
- **Real-Time WebSocket Streaming**: Instant in-app notification delivery to connected storefronts (`apps/client`) and dashboards (`apps/admin`).
- **User Preference Enforcement**: Granular per-user and per-notification-type channel enablement controls.
- **Deduplication & Idempotency**: Fast-path Redis deduplication (`SETNX` with TTL) + durable PostgreSQL event tracking preventing duplicate notifications on Kafka replays.
- **Resilient Worker Pool**: Native goroutine worker pools per channel with configurable concurrency, exponential backoff retries, and dead-letter classification.
- **Full Observability**: OpenTelemetry distributed tracing, structured JSON logging with context propagation, and Prometheus metrics exposition (`/metrics`).

---

## 3. Database Schema

The service manages its own PostgreSQL database via the SQL migrations embedded in
`migrations/`:

| Table                      | Description                                                                                              |
| :------------------------- | :------------------------------------------------------------------------------------------------------- |
| `notifications`            | Central notification records with priority, metadata, and read status.                                   |
| `notification_deliveries`  | Per-channel delivery lifecycle tracking (`pending`, `processing`, `delivered`, `failed`, `dead_letter`). |
| `notification_preferences` | User-defined channel toggles per notification type.                                                      |
| `notification_templates`   | Parameterized template definitions for subjects and body content.                                        |
| `user_devices`             | Registered push tokens and platform metadata (iOS, Android, Web).                                        |
| `notification_events`      | Idempotency log recording consumed Kafka events.                                                         |
| `schema_migrations`        | Applied migration versions with checksums and timestamps (written by the runner).                        |

### Migrations

Migrations are applied automatically on startup by `internal/db`, so a deployment never
needs a separate migration step:

- `migrations/*.up.sql` are embedded in the binary with `go:embed` and applied in version
  order; `migrations/*.down.sql` are kept for manual rollback only.
- Every applied script is recorded in `schema_migrations` (version, name, SHA-256
  checksum, `applied_at`), so already-applied migrations are skipped on the next boot.
- The whole run happens in one transaction guarded by a PostgreSQL advisory lock, so
  several replicas can start at once without racing.
- Editing a migration that is already recorded fails the run with a checksum mismatch —
  add a new migration instead of editing an applied one.
- A failure is logged as a warning rather than killing the process, matching the existing
  "PostgreSQL may not be ready yet" boot behaviour; the next startup retries.

To add a schema change, create the next versioned pair (for example
`000002_add_delivery_latency.up.sql` and `.down.sql`) and restart the service. To inspect
what has been applied:

```bash
psql "$DATABASE_URL" -c "SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version;"
```

Inspect the runner directly with `go test ./internal/db/`; the live-database check is
opt-in:

```bash
NOTIFICATION_DB_TEST_URL="$DATABASE_URL" go test ./internal/db/ -run Integration -v
```

---

## 4. HTTP API Endpoints

| Method  | Path                         | Auth             | Purpose                                             |
| :------ | :--------------------------- | :--------------- | :-------------------------------------------------- |
| `GET`   | `/health`                    | Public           | Multi-dependency health report (PostgreSQL, Redis). |
| `GET`   | `/ready`                     | Public           | Readiness probe.                                    |
| `GET`   | `/metrics`                   | Public / Scraper | Standard Prometheus text exposition.                |
| `GET`   | `/ws`                        | User Token       | WebSocket upgrade for real-time in-app stream.      |
| `GET`   | `/notifications`             | User             | Paginated notification history (`limit`, `offset`). |
| `GET`   | `/notifications/unread`      | User             | List unread notifications and total unread count.   |
| `PATCH` | `/notifications/:id/read`    | User             | Mark single notification as read.                   |
| `PATCH` | `/notifications/read-all`    | User             | Mark all unread notifications as read.              |
| `POST`  | `/notifications/devices`     | User             | Register device push token.                         |
| `GET`   | `/notifications/preferences` | User             | Retrieve channel preferences.                       |
| `PUT`   | `/notifications/preferences` | User             | Update channel preferences.                         |
| `GET`   | `/notifications/templates`   | User / Admin     | List available templates.                           |

---

## 5. Starting the Service

### Option A: Via Turborepo (Recommended Monorepo Workflow)

The service is integrated into the root Turborepo workspace.

```bash
# Start all microservices concurrently (including notification-service)
pnpm dev

# Or start only the notification-service via Turbo filter
pnpm --filter notification-service dev
```

### Option B: With Docker Compose

`apps/notification-service` includes its own `docker-compose.yml` that provisions the Go binary, dedicated PostgreSQL instance (`port 5434`), Redis instance (`port 6380`), and connects to the shared Kafka network:

```bash
cd apps/notification-service
go test -v ./...
```

### Option C: Running Locally with Go

```bash
# 1. Navigate to service folder
cd apps/notification-service

# 2. Configure environment variables (copy .env.example if not created)
cp .env.example .env

# 3. Run directly with Go
go run ./cmd/notification/main.go
```

---

## 6. Testing & Quality Checks

Run unit and integration tests across all Go packages:

```bash
# Run with Race Detector and coverage metrics
go test -v -race -cover ./...

# Or via pnpm / Turborepo filter
pnpm --filter notification-service test

# Static code analysis
go vet ./...
# Or via Turbo typecheck pipeline
pnpm --filter notification-service check-types
```
