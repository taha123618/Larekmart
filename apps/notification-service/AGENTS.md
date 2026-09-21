# AGENTS.md — apps/notification-service

Scope: `apps/notification-service` only. Root rules still apply — start there.

## What this service is

The **`notification-service`** is an independent, production-grade Go microservice responsible for orchestrating multi-channel notifications (Email, SMS, Push, In-App) across the Larekmart platform.

It operates on **port 8005** with a lightweight Chi HTTP server, Go-native worker pools, PostgreSQL persistence, Redis deduplication, WebSocket real-time in-app streaming, and OpenTelemetry observability.

## Architectural Boundaries

- **Event-driven integration**: Consumes domain events (`user.created`, `order.created`, `payment.successful`, `notification.dispatch`) from Apache Kafka.
- **Provider-agnostic channels**: Implements common `Channel` interface in `internal/channels/`. Business logic never hardcodes third-party provider dependencies.
- **Email synergy**: Orchestrates email notifications and delegates delivery execution to `email-service` / Kafka topic `email.dispatch`.
- **In-App WebSockets**: Exposes `GET /ws` for authenticated real-time notification streaming to storefront and admin frontends.
- **Persistence & Idempotency**: Manages delivery tracking, preferences, and templates in PostgreSQL. Uses Redis for fast atomic event deduplication (`SETNX` with TTL).

## Public HTTP Endpoints

- `GET /health` — Multi-dependency JSON health inspection (PostgreSQL, Redis).
- `GET /ready` — Readiness check.
- `GET /metrics` — Standard Prometheus metrics exposition.
- `GET /ws` — WebSocket in-app notification upgrade.
- `GET /notifications` — List user notifications with pagination (`limit`, `offset`).
- `GET /notifications/unread` — List unread notifications and total unread count.
- `PATCH /notifications/{id}/read` — Mark single notification as read.
- `PATCH /notifications/read-all` — Mark all user notifications as read.
- `POST /notifications/devices` — Register push device token.
- `GET /notifications/preferences` — Get user channel preferences.
- `PUT /notifications/preferences` — Update channel preference.
- `GET /notifications/templates` — List active notification templates.

## Engineering Conventions

- **Clean Internal Layout**: All application logic lives inside `internal/`.
- **No Global Mutable State**: Dependencies are injected explicitly into constructors.
- **Context Propagation**: Every database query, Kafka handler, and HTTP request propagates `context.Context` with OpenTelemetry trace spans.
- **Native Worker Pools**: Channel delivery tasks run via goroutines and buffered channels with exponential backoff and dead-letter classification.

## Database Migrations

- Schema changes are SQL files in `migrations/` named `<version>_<name>.up.sql`, embedded in
  the binary and applied on startup by `internal/db` (`db.Run`). Never apply schema changes
  by hand — add a migration so the change is recorded in `schema_migrations`.
- The runner records each applied script in `schema_migrations` with a SHA-256 checksum, so
  already-applied migrations are skipped and edits to applied scripts are rejected.
- Never edit a migration that has been applied; add the next versioned migration instead.
- Each run is a single transaction guarded by `pg_advisory_xact_lock`, and a failed run is
  logged as a warning rather than fatally terminated.

## Verification

```bash
cd apps/notification-service
go test -v ./...
go build ./cmd/notification/main.go

# Migration runner, including the live-database check
go test ./internal/db/
NOTIFICATION_DB_TEST_URL="$DATABASE_URL" go test ./internal/db/ -run Integration -v
```
