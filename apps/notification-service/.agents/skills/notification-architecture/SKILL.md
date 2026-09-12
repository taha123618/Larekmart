---
name: notification-architecture
description: Architecture, event processing pipeline, deduplication, and worker pools in notification-service.
---

# Notification Service Architecture & Pipeline

Use this skill when modifying, debugging, or adding features to the Go `notification-service` event pipeline or worker architecture.

## 1. Processing Lifecycle

```text
Kafka Event -> Domain Event Handler -> Redis Fast Deduplication -> Postgres Idempotency
            -> User Preferences Check -> Template Render -> Postgres Persistence
            -> Delivery Job Enqueue -> Channel Worker Pool (Goroutines) -> Provider
```

## 2. Key Rules

1. **Strict Idempotency**: Always verify events through Redis fast check (`SETNX`) and PostgreSQL `notification_events`. Duplicate events must never result in duplicate notifications.
2. **Channel Independence**: Each channel (Email, SMS, Push, In-App) runs on its own dedicated bounded worker pool. A slow SMS or Push provider must never block In-App or Email processing.
3. **Exponential Backoff**: Transient errors must be retried with exponential backoff (`initialBackoff * 2^(attempt-1)`). Permanent failures move to `dead_letter` status in PostgreSQL.
4. **WebSocket Thread-Safety**: The `websocket.Hub` protects client maps with read/write mutexes. Always broadcast or unicast via hub methods (`SendToUser`, `BroadcastAll`).
