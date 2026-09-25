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

### MongoDB (order-service / cart-service / order-db / cart-db)

1. Verify MongoDB is running on port `27017` with authentication enabled:
   `MONGO_URL="mongodb://root:example@localhost:27017/order_db?authSource=admin"` (order-service)
   `MONGO_URL="mongodb://root:example@localhost:27017/ecommerce?authSource=admin"` (cart-service)
2. Use Mongo Express UI at `http://localhost:8081` (`mongoexpressuser` / `mongoexpresspass`) to visually inspect collections.
3. Check `connectOrderDB()` or `connectCartDB()` service logs for connection or authentication errors.

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

## 6. Recommendation Service (Python FastAPI :8008)

### Issue: Recommendations returning fallback or empty lists

1. Check service liveness & readiness: `GET http://localhost:8008/health/live` and `GET http://localhost:8008/health/ready`.
2. Verify Redis cache keys for recommendations: `recommendations:*` in Redis database 0.
3. Check PostgreSQL with `pgvector` connectivity: verify `product_embeddings` and `user_interactions` tables exist and have valid embeddings.
4. Verify Kafka consumer loop status: `aiokafka` consumer group logs for `order.created`, `payment.successful`, and `product.*` events.
5. Check Celery background worker tasks:
   ```bash
   uv run celery -A app.workers.celery inspect active
   ```
6. Inspect Prometheus metrics at `http://localhost:8008/metrics` (`recommendation_requests_total`, `recommendation_latency_seconds`, `recommendation_cache_hits_total`).
