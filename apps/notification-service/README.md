# Notification Service (`apps/notification-service`)

A high-throughput, production-grade **Go** microservice providing a unified notification platform for Email, SMS, Push, and In-App delivery across the **Larekmart** e-commerce microservices platform.

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

- **Multi-Channel Orchestration**: Unified lifecycle management for Email, SMS, Push, and In-App notifications.
- **Provider-Agnostic Channel Abstraction**: Clean `Channel` interface with pluggable providers (Twilio, FCM, APNS, Mock).
- **Email Service Synergy**: Coordinates email notifications and delegates heavy email transport to `email-service` via Kafka.
- **Real-Time WebSocket Streaming**: Instant in-app notification delivery to connected browser storefronts and admin dashboards.
- **User Preference Enforcement**: Granular per-user and per-notification-type channel enablement controls.
- **Deduplication & Idempotency**: Fast-path Redis deduplication (`SETNX` with TTL) + durable PostgreSQL event tracking preventing duplicate notifications on Kafka replays.
- **Resilient Worker Pool**: Native goroutine worker pools per channel with configurable concurrency, exponential backoff retries, and dead-letter classification.
- **Full Observability**: OpenTelemetry distributed tracing, structured JSON logging with context propagation, and Prometheus metrics exposition (`/metrics`).

---

## 3. Database Schema

The service manages its own PostgreSQL database via SQL migrations in `migrations/`:

| Table                      | Description                                                                                              |
| :------------------------- | :------------------------------------------------------------------------------------------------------- |
| `notifications`            | Central notification records with priority, metadata, and read status.                                   |
| `notification_deliveries`  | Per-channel delivery lifecycle tracking (`pending`, `processing`, `delivered`, `failed`, `dead_letter`). |
| `notification_preferences` | User-defined channel toggles per notification type.                                                      |
| `notification_templates`   | Parameterized template definitions for subjects and body content.                                        |
| `user_devices`             | Registered push tokens and platform metadata (iOS, Android, Web).                                        |
| `notification_events`      | Idempotency log recording consumed Kafka events.                                                         |

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

## 5. Local Development & Testing

### Running Tests

```bash
cd apps/notification-service
go test -v ./...
```

### Running Locally

```bash
cd apps/notification-service
go run ./cmd/notification/main.go
```

### Building Docker Image

```bash
docker build -t larekmart-notification-service apps/notification-service
```
