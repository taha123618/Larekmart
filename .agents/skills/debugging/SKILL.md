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

### MySQL (tax-service & return-service)

1. Verify MySQL is running on port `3306`:
   `MYSQL_URL="mysql://root:admin123@127.0.0.1:3306/tax_db"` (tax-service)
   `MYSQL_URL="mysql://root:admin123@127.0.0.1:3306/return_db"` (return-service)
2. Verify migrations are applied:
   ```bash
   pnpm --filter tax-service db:migrate
   pnpm --filter return-service db:migrate
   ```
3. Test connectivity and schema tables:
   ```bash
   pnpm --filter tax-service db:seed
   pnpm --filter return-service test
   ```

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

## 7. Promotion Service (Hono :8016)

### Issue: Coupon code rejection or reservation failure

1. **Validation & Budget Checks**:
   - Verify campaign status is `ACTIVE` and within `startDate` and `endDate`.
   - Check if usage limits (`maxRedemptionsTotal`, `maxRedemptionsPerUser`) or budget caps (`budgetLimit`) are exhausted.
   - Verify cart subtotal meets `minSubtotal` threshold.
2. **Reservation Lifecycle & Expiration**:
   - Reservations hold budget for 15 minutes in `larekmart_promotion_db` and Redis.
   - On checkout completion, order-service passes `reservationId`, which triggers redemption commit upon `order.created`.
   - Verify expired reservations are reclaimed by background TTL reaper.
3. **Database & Migrations**:
   - Database name: `larekmart_promotion_db` on PostgreSQL (:5432).
   - Run migrations: `pnpm --filter promotion-service db:migrate`.
   - Seed sample campaigns: `pnpm --filter promotion-service db:seed`.
4. **Kafka Consumers & Producers**:
   - Verify `order-events.consumer` is actively subscribed to `order.created`.
   - Confirm producer emits `promotion.redeemed` and `promotion.created` events.

## 8. Return Service (Koa :8018)

### Issue: Return eligibility rejection, reverse shipment failure, or refund SAGA stalling

1. **Eligibility & Policy Constraints**:
   - Verify order status is `DELIVERED` before initiating a return (`order-service`).
   - Check if the delivery timestamp falls within the 14-day policy window (`return_policy_versions`).
   - Confirm returned quantity does not exceed unreturned delivered items (`return_items`).
   - Verify item is not in an exempt/final-sale category.

2. **State Machine Transitions**:
   - Allowed lifecycle: `REQUESTED` → `APPROVED` → `AWAITING_RETURN_SHIPMENT` → `IN_TRANSIT` → `RECEIVED` → `INSPECTION` → `REFUND_PENDING` → `COMPLETED`.
   - Terminal states: `REJECTED`, `CANCELLED`, `REFUND_FAILED`.
   - Transitions are strictly audited in `return_state_transitions`; check logs for invalid state transition rejections (`InvalidStateTransitionError`).

3. **Reverse Logistics & Carrier Tracking**:
   - When return is approved, `return-service` emits `return.shipment.requested`.
   - `shipping-service` generates return label and emits `shipping.label.created` / `return.shipment.created`.
   - If shipping tracking fails to update, check `shipping-service` carrier credentials (TCS/Leopards/DHL/FedEx) or verify customer tracking submission via `POST /api/v1/returns/:returnId/tracking`.

4. **Stripe Refund SAGA Coordination**:
   - On warehouse inspection completion (`POST /api/v1/admin/returns/:id/inspect`), `return-service` calculates prorated discount and tax adjustments, then emits `return.refund.requested`.
   - `payment-service` executes the Stripe refund and emits `payment.refund.succeeded` or `payment.refund.failed`.
   - If a refund fails, return status transitions to `REFUND_FAILED`. Trigger manual recovery via `POST /api/v1/admin/returns/:id/refund/retry`.

5. **Transactional Outbox & Database**:
   - MySQL database `return_db` on port 3306.
   - Run migrations: `pnpm --filter return-service db:migrate`.
   - Inspect pending outbox events: verify `return_outbox` table where `status = 'PENDING'` is being processed by the outbox worker loop.
   - Metrics: inspect Prometheus metrics at `http://localhost:8018/metrics` (`returns_total`, `refunds_processed_total`, `outbox_published_total`).
