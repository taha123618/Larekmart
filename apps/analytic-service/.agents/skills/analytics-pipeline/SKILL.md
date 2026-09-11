---
name: analytics-pipeline
description: Use when modifying Kafka event stream listeners, consumer subscriptions, or resilient background processing in apps/analytic-service.
---

# Analytics Pipeline Workflows

Guidance for developing the event consumption and pipeline logic in `apps/analytic-service`.

## 1. Pipeline Architecture

- `analytic-service` is a headless event consumer worker with no inbound HTTP listeners.
- Consumes events from `@repo/kafka` using the consumer group `analytic-service-group`.
- Extracts message payloads using `{ value: payload }` envelope compatibility (`message.value || message`).

## 2. Event Subscriptions

The analytics pipeline listens to all platform lifecycle events:

- `payment.successful`: Revenue aggregation, customer checkout logs, and product quantity tallies.
- `order.created`: Order completion and fulfillment metrics.
- `user.created`: New user registration counters.
- `product.created`: Inventory additions and catalog growth metrics.
- `product.deleted`: Catalog removal tracking.

## 3. Resilience & Failure Handling

- Wrap event processing in structured try/catch blocks within handlers to protect the consumer loop.
- If the database is offline or unreachable, record in-memory metrics and log event details without throwing unhandled rejections.

## 4. Verification

```bash
pnpm --filter analytic-service check-types
```
