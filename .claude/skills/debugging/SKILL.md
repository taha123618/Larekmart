---
name: debugging
description: Use when troubleshooting service communication, Kafka consumer lag, database connections, Clerk authentication, or Next.js hydration issues in Larekmart.
---

# Debugging & Diagnostics

Actionable troubleshooting playbooks for Larekmart services and infrastructure.

## 1. Kafka Event Troubleshooting

### Issue: Event not being processed by consumer

1. Check Kafka UI at `http://localhost:8080`.
2. Inspect topic messages:
   - Does the message match the `{ value: <payload> }` envelope?
   - Is the consumer group active and assigned partitions?
3. Ensure the consumer was registered before starting:
   ```ts
   await consumer.connect();
   await consumer.subscribe([
     { topicName: "topic.name", topicHandler: handler },
   ]);
   ```
4. Verify Kafka brokers are healthy:
   ```bash
   docker compose -f packages/kafka/docker-compose.yml ps
   ```

## 2. Clerk Authentication & Session Issues

### Issue: Backend returns 401 Unauthorized or 403 Forbidden

1. Verify `CLERK_SECRET_KEY` is loaded in the service `.env`.
2. Verify Bearer token is attached in frontend headers:
   `Authorization: Bearer <token>`
3. For admin routes (`403`), verify session claims:
   - Check `sessionClaims.metadata.role === "admin"`.
   - In Clerk Dashboard, verify the user's public or private metadata includes `{ "role": "admin" }`.

## 3. Database Connection Issues

### PostgreSQL (product-service / product-db)

1. Verify PostgreSQL is listening on port `5432`:
   `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ecommerce"`
2. If schema types are missing:
   ```bash
   pnpm --filter @repo/product-db db:generate
   ```

### MongoDB (order-service / order-db)

1. Verify MongoDB is running on port `27017`:
   `MONGO_URL="mongodb://localhost:27017/ecommerce"`
2. Check `connectOrderDB()` in `apps/order-service/src/index.ts` logs for connection errors.

## 4. Next.js Hydration & SSR Issues

### Issue: Hydration mismatch between server and client

1. Avoid accessing `window` or `localStorage` during initial server render.
2. For the Zustand cart store, ensure state persistence uses hydration-safe hooks or `"use client"` components.
3. Check browser console for specific mismatched HTML tags.

## 5. Notification Service & WebSockets (Go :8005)

### Issue: In-app WebSocket not receiving real-time notifications

1. Check WebSocket connection endpoint: `ws://localhost:8005/ws?token=<token>`.
2. Inspect `GET /health` on port 8005 to verify PostgreSQL pool and Redis connection statuses.
3. Verify Prometheus metrics at `GET /metrics` (`active_websocket_connections`, `notification_deliveries_total`).
4. Check worker pool logs for dead-letter classification on exhausted retries.
5. Verify Redis deduplication key `notification:event:<id>` is not prematurely filtering new events.
