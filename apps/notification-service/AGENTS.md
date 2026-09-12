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

## Verification

```bash
cd apps/notification-service
go test -v ./...
go build ./cmd/notification/main.go
```
