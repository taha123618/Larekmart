---
name: debugging
description: Use when troubleshooting service communication, Kafka consumer lag, database connections, Clerk authentication, or Next.js hydration issues in Larekmart.
---

# Debugging & Diagnostics

Actionable troubleshooting playbooks for Larekmart services and infrastructure.

## 1. Kafka Event Troubleshooting

### Issue: Event not being processed by consumer

1. Check Kafka UI at `http://localhost:8090`.
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

### Issue: Hydration mismatch between server and client (React 19 / Next.js 16)

1. **Framer Motion SSR Attribute Collisions**:
   - Symptoms: Console warning reporting `tabindex="0"` or internal `data-motion-id` differences on buttons or list items.
   - Cause: `<motion.button>` or dynamic `layoutId` on server-rendered listing grids (`ProductCard.tsx`, `CategoriesClient.tsx`).
   - Fix: Replace motion wrappers on static grids with GPU-accelerated Tailwind transitions (`transition-all duration-300 hover:scale-[1.02] active:scale-95`). Reserve Framer Motion for client-only overlays (`CartDrawer`, `QuickViewModal`, `cart/page.tsx`).

2. **Persistent LocalStorage Store Drift (`wishlistStore`, `cartStore`)**:
   - Symptoms: Heart icon or cart badge mismatching server HTML on first load.
   - Cause: Store reads `localStorage` synchronously during render pass.
   - Fix: Guard client-only state checks with an `isMounted` flag:
     ```tsx
     const [isMounted, setIsMounted] = useState(false);
     useEffect(() => {
       setIsMounted(true);
     }, []);
     const isFavorited = isMounted ? isInWishlist(product.id) : false;
     ```
     Add `suppressHydrationWarning` on the button or icon element.

3. **Live Countdown & Timestamp Drift**:
   - Symptoms: Text content mismatch in seconds/milliseconds (`FlashDeals.tsx`).
   - Cause: SSR time differs from browser execution time.
   - Fix: Add `suppressHydrationWarning` to the dynamic ticker `<span>` or parent container.

4. **Browser Extension Injections**:
   - Symptoms: `data-motion-id` or inline styles injected into SVGs before React hydration completes.
   - Fix: Add `suppressHydrationWarning` directly to the `<svg>` or Lucide icon component (e.g. `<Sparkles suppressHydrationWarning />`).

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
