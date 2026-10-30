# API Registry & Service Endpoints

Comprehensive catalog of all HTTP endpoints exposed by Larekmart backend services.

## Service Ports & Protocols

| Service                  | Port   | Framework              | Auth Guard                         | Owner                                                                     |
| ------------------------ | ------ | ---------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| `product-service`        | `8000` | Express 5              | `shouldBeUser` / `shouldBeAdmin`   | Product & Category Catalog                                                |
| `order-service`          | `8001` | Fastify 5              | `shouldBeUser` / `shouldBeAdmin`   | Order Management & Analytics                                              |
| `payment-service`        | `8002` | Hono 4                 | `shouldBeUser` / Webhook Signature | Stripe Checkout & Webhooks                                                |
| `auth-service`           | `8003` | Express 5              | `shouldBeAdmin`                    | Admin User Management Proxy                                               |
| `analytic-service`       | `8004` | Go 1.22 / Chi          | `shouldBeAdmin` / Internal Secret  | Analytics & KPI Aggregations                                              |
| `notification-service`   | `8005` | Go / Chi               | User token / public probes         | Notifications, WebSockets & delivery                                      |
| `search-service`         | `8006` | Fastify 5              | Public search / `shouldBeAdmin`    | Product search, indexing & autocomplete                                   |
| `inventory-service`      | `8007` | Hono 4                 | `shouldBeUser` / `shouldBeAdmin`   | Stock, reservations & warehouse inventory                                 |
| `recommendation-service` | `8008` | Python 3.12+ / FastAPI | Public / User telemetry            | AI recommendations, embeddings & interactions                             |
| `media-service`          | `8013` | Hono 4                 | `shouldBeUser` / `shouldBeAdmin`   | Media uploads, storage, variants & lifecycle                              |
| `review-service`         | `8014` | Fastify 5              | `shouldBeUser` / `shouldBeAdmin`   | Customer reviews, ratings, verified gating, moderation                    |
| `wishlist-service`       | `8015` | Fastify 5              | `shouldBeUser` / Public link token | Wishlists, saved products, guest merge, price-drop                        |
| `promotion-service`      | `8016` | Hono 4                 | `shouldBeUser` / `shouldBeAdmin`   | Campaigns, coupons, discount eligibility, budgets & checkout reservations |
| `vendor-service`         | `8020` | NestJS 10 (Fastify)    | `shouldBeUser` / `shouldBeAdmin`   | Legal business entities, KYB, documents & verifications                   |
| `seller-service`         | `8021` | Fastify 5              | `shouldBeUser` / `shouldBeAdmin`   | Marketplace storefronts, staff, delegations & governance                  |
| `email-service`          | —      | Node.js Worker         | None (Kafka only)                  | Transactional Email Dispatch                                              |

---

## 1. Product Service (`:8000`)

### `GET /products`

- **Auth**: Public
- **Query Params**: `category` (slug), `search` (name query), `sort` (`asc` | `desc`), `page`, `limit`
- **Response**: `{ products: ProductType[], total: number }`

### `GET /products/search`

- **Auth**: Public
- **Query Params**: search/filter params validated by `SearchQueryParamsSchema` (`q`, `page`, `limit`, `sort`, `category`, `categorySlug`, `brand`, `min_price`, `max_price`, `color`, `size`, `inStock`, `rating`, `seller`, `tags`)
- **Response**: `SearchResponse` — `{ data: SearchProductDocument[], meta, facets }` read from the shared OpenSearch index via `@repo/opensearch`

### `GET /products/:id`

- **Auth**: Public
- **Response**: `ProductType`

### `POST /products`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `ProductFormSchema`
- **Side Effect**: Emits `product.created` Kafka event

### `PUT /products/:id`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: Partial `ProductFormSchema`
- **Response**: Updated `ProductType`

### `POST /products/backfill-search`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `SearchBackfillRequestSchema` (`batchSize` ≤ 1000, `limit`, `afterId`, `timeBudgetMs` ≤ 120000, `dryRun`)
- **Response**: `SearchBackfillResponse` — `{ processed, published, failed, nextAfterId?, hasMore, durationMs }`
- **Side Effect**: Republishes catalog products as `product.updated` Kafka events so search-service rebuilds index documents that predate the full `product.created` payload (missing `images`, `sizes`, `colors` → missing thumbnails and color/size facets).
- **Note**: Windowed. One call processes up to its time budget, then returns `hasMore` + `nextAfterId`; repeat with `afterId=nextAfterId` until `hasMore` is false. Nothing is indexed by product-service itself — the events travel the normal Kafka write path into search-service.

### `DELETE /products/:id`

- **Auth**: Admin (`shouldBeAdmin`)
- **Side Effect**: Emits `product.deleted` Kafka event

### `GET /categories`

- **Auth**: Public
- **Response**: `CategoryType[]`

### `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id`

- **Auth**: Admin (`shouldBeAdmin`)

### `GET /health`

- **Auth**: Public
- **Response**: Comprehensive multi-dependency health report:

```json
{
  "service": "product-service",
  "status": "healthy",
  "uptimeSeconds": 42,
  "timestamp": "2026-09-12T04:08:00.000Z",
  "checks": {
    "memory": {
      "status": "healthy",
      "latencyMs": 0,
      "message": "Heap: 24.50 MB / 512.00 MB"
    },
    "postgres": {
      "status": "healthy",
      "latencyMs": 4,
      "message": "PostgreSQL ping successful (4ms)"
    }
  },
  "summary": { "total": 2, "healthy": 2, "degraded": 0, "unhealthy": 0 }
}
```

### `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: OpenMetrics / Prometheus text exposition (`Content-Type: text/plain; version=0.0.4`) containing request counts, latencies (p50/p90/p99), and error counters.

---

## 2. Order Service (`:8001`)

### `GET /user-orders`

- **Auth**: Authenticated User (`shouldBeUser`)
- **Response**: `OrderType[]` for logged-in user

### `GET /orders`

- **Auth**: Admin (`shouldBeAdmin`)
- **Query Params**: `limit` (number)
- **Response**: `OrderType[]`

### `GET /order-chart`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `OrderChartType[]` (6-month sales and revenue trends)

### `GET /health`

- **Auth**: Public
- **Response**: Multi-dependency health report (Memory + MongoDB connection state)

### `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Prometheus text exposition format

---

## 3. Payment Service (`:8002`)

### `POST /sessions/create-checkout-session`

- **Auth**: Authenticated User (`shouldBeUser`)
- **Body**: `{ cart: CartItemType[] }`
- **Response**: `{ clientSecret: string }`

### `GET /sessions/:id`

- **Auth**: Authenticated User (`shouldBeUser`)
- **Response**: `{ status: string, customer_email: string }`

### `POST /webhooks/stripe`

- **Auth**: Stripe Webhook Signature (`stripe-signature` header)
- **Side Effect**: Emits `payment.successful` Kafka event on `checkout.session.completed`

### `GET /health`

- **Auth**: Public
- **Response**: Multi-dependency health report (Memory)

### `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Prometheus text exposition format

---

## 4. Auth Service (`:8003`)

### `GET /users`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: Clerk user list array

### `GET /users/:id`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: Clerk user object

### `POST /users`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `UserFormSchema`
- **Side Effect**: Emits `user.created` Kafka event

### `DELETE /users/:id`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `{ message: "User deleted" }`

### `GET /health`

- **Auth**: Public
- **Response**: Multi-dependency health report (Memory)

### `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Prometheus text exposition format

---

## 5. Analytic Service (`:8004`)

### `GET /analytics/public`

- **Auth**: Public (Unauthenticated / Public Storefront)
- **Response**: `PublicTrustMetricsType` (`activeSellersCount`, `verifiedKybVendorsCount`, `listedProductsCount`, `deliveredShipmentsCount`, `deliverySuccessRate`)

### `GET /analytics/summary`

- **Auth**: Admin (`shouldBeAdmin` / `X-Internal-Secret`)
- **Response**: `AnalyticsSummaryType` (gross revenue, processed orders, signups, products created/deleted, shipments delivered, delivery success rate, returns completed, discounts applied)

### `GET /analytics/merchants`

- **Auth**: Admin (`shouldBeAdmin` / `X-Internal-Secret`)
- **Response**: `AnalyticsMerchantsType` (total merchants, active merchants, pending verifications, total merchant revenue)

### `GET /analytics/operations`

- **Auth**: Admin (`shouldBeAdmin` / `X-Internal-Secret`)
- **Response**: `OperationsAnalyticsMetricsType` (dispatched shipments, delivered shipments, delivery success rate, return requests, returns completed, active disputes, dispute resolution rate, average fulfillment hours)

### `GET /analytics/commerce`

- **Auth**: Admin (`shouldBeAdmin` / `X-Internal-Secret`)
- **Response**: `CommerceAnalyticsMetricsType` (total tax collected, promotional discounts applied, coupon redemptions count, vendor escrows locked/released, vendor payouts processed, AOV in paisa)

### `GET /analytics/daily-chart`

- **Auth**: Admin (`shouldBeAdmin` / `X-Internal-Secret`)
- **Query Params**: `days` (number, default: 30)
- **Response**: `AnalyticsDailyChartType[]` (Redis cached 60s)

### `GET /analytics/events`

- **Auth**: Admin (`shouldBeAdmin` / `X-Internal-Secret`)
- **Query Params**: `limit` (number, default: 20)
- **Response**: `AnalyticsEventType[]` (Redis cached 15s)

### `GET /health`

- **Auth**: Public
- **Response**: Multi-dependency health report (Service uptime, PostgreSQL pool status, Redis status)

### `GET /health/live` & `GET /health/ready`

- **Auth**: Public
- **Response**: Kubernetes liveness and readiness probe status

### `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Prometheus text exposition format (counters, latencies, queue depths, batch metrics)

---

## 6. Search Service (`:8006`)

### `GET /api/v1/search`

- **Auth**: Public
- **Query Params**: `q`, `page`, `limit`, `sort`, `categorySlug`, `brand`, `min_price`, `max_price`, `color`, `size`, `inStock`, `rating`
- **Response**: Search results with `data`, pagination `meta`, and multi-select-aware `facets`
- **Cache**: Redis read-through cache under the `search:v1:` namespace

### `GET /api/v1/search/suggestions`

- **Auth**: Public
- **Query Params**: `q` (required), `limit` (maximum 20)
- **Response**: Rich product suggestions suitable for autocomplete and product deep links

### `POST /api/v1/index/reindex`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `{ batchSize?: number, recreateAlias?: boolean }`
- **Side Effect**: Reindexes OpenSearch documents and optionally swaps the `products` alias

### `GET /health`, `GET /ready`, `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Liveness, OpenSearch/Redis readiness, and Prometheus metrics respectively

## 7. Inventory Service (`:8007`)

### `GET /api/v1/inventory/:productId` and `GET /api/v1/inventory/:productId/availability`

- **Auth**: Authenticated user
- **Query Params**: `variantId`, `warehouseId`
- **Response**: Warehouse availability with available, reserved, sold, and aggregate available quantities

### `POST /api/v1/inventory/reservations`

- **Auth**: Authenticated user
- **Body**: `{ productId, variantId, warehouseId, quantity, referenceType, referenceId, expiresAt }`
- **Side Effect**: Atomically moves available stock to reserved stock and emits `inventory.reserved`

### `POST /api/v1/inventory/reservations/:id/confirm`

- **Auth**: Reservation owner
- **Side Effect**: Moves reserved stock to sold stock and emits `inventory.reservation.confirmed`

### `POST /api/v1/inventory/reservations/:id/release` and `/expire`

- **Auth**: Reservation owner
- **Side Effect**: Returns reserved stock to available stock and emits the corresponding inventory event

### Admin inventory routes

- `POST /api/v1/inventory/items` — create a warehouse inventory item
- `POST /api/v1/inventory/restock` — add available stock
- `POST /api/v1/inventory/adjustments` — apply an adjustment or damage movement
- `GET /api/v1/inventory/admin/low-stock` — list low/out-of-stock items
- `GET /api/v1/inventory/admin/movements/:productId` — inspect the movement ledger

All mutation routes use PostgreSQL transactions through `@repo/inventory-db`; Redis is
only a best-effort availability cache.

## 8. Notification Service (`:8005`)

### `GET /health`

- **Auth**: Public
- **Response**: Multi-dependency health report (`postgres`, `redis`, `uptimeSeconds`, `summary`)

### `GET /ready`

- **Auth**: Public
- **Response**: `{ "status": "ready" }`

### `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Prometheus text exposition format

### `GET /ws`

- **Auth**: User (`?user_id=` or `Authorization: Bearer <token>`)
- **Protocol**: WebSocket upgrade for real-time in-app notification streaming

### `GET /notifications`

- **Auth**: User
- **Query Params**: `limit` (number, default: 20), `offset` (number, default: 0)
- **Response**: `{ "notifications": Notification[], "count": number }`

### `GET /notifications/unread`

- **Auth**: User
- **Query Params**: `limit` (number, default: 50)
- **Response**: `{ "notifications": Notification[], "unread_count": number }`

### `PATCH /notifications/:id/read`

- **Auth**: User
- **Response**: `{ "success": true, "updated": boolean }`

### `PATCH /notifications/read-all`

- **Auth**: User
- **Response**: `{ "success": true, "rows_affected": number }`

### `POST /notifications/devices`

- **Auth**: User
- **Body**: `{ "device_token": string, "platform": "ios" | "android" | "web" }`
- **Response**: `{ "success": true, "message": string }`

### `GET /notifications/preferences`

- **Auth**: User
- **Response**: `{ "user_id": string, "preferences": Record<string, NotificationPreference> }`

### `PUT /notifications/preferences`

- **Auth**: User
- **Body**: `{ "notification_type": string, "email_enabled": boolean, "sms_enabled": boolean, "push_enabled": boolean, "inapp_enabled": boolean }`
- **Response**: `{ "success": true, "preference": NotificationPreference }`

### `GET /notifications/templates`

- **Auth**: User / Admin
- **Response**: `{ "templates": NotificationTemplate[], "count": number }`

---

## 9. Recommendation Service (`:8008`)

### `GET /api/v1/recommendations/home`

- **Auth**: Public / Authenticated user
- **Query Params**: `userId` (optional), `limit` (default: 10)
- **Response**: `HomeRecommendationsResponseType` — `{ trending: RecommendationType[], popular: RecommendationType[], personalized?: RecommendationType[], recentlyViewed?: RecommendationType[], userId?: string }`
- **Cache**: Redis read-through cache under `recommendations:home:*` namespace

### `GET /api/v1/recommendations/personalized`

- **Auth**: Authenticated user
- **Query Params**: `userId` (required), `limit` (default: 10)
- **Response**: `RecommendationResponseType`

### `GET /api/v1/recommendations/trending`

- **Auth**: Public
- **Query Params**: `limit` (default: 10), `windowHours` (default: 48), `categorySlug` (optional)
- **Response**: `RecommendationResponseType`

### `GET /api/v1/recommendations/popular`

- **Auth**: Public
- **Query Params**: `limit` (default: 10), `categorySlug` (optional)
- **Response**: `RecommendationResponseType`

### `GET /api/v1/recommendations/category/:categoryId`

- **Auth**: Public
- **Query Params**: `limit` (default: 10)
- **Response**: `RecommendationResponseType`

### `GET /api/v1/recommendations/recently-viewed`

- **Auth**: Authenticated user
- **Query Params**: `userId` (required), `limit` (default: 10)
- **Response**: `RecommendationResponseType`

### `GET /api/v1/recommendations/similar/:productId` and `/product/:productId`

- **Auth**: Public
- **Query Params**: `limit` (default: 10)
- **Response**: `RecommendationResponseType`

### `GET /api/v1/recommendations/frequently-bought-together/:productId`

- **Auth**: Public
- **Query Params**: `limit` (default: 5)
- **Response**: `RecommendationResponseType`

### `POST /api/v1/interactions`

- **Auth**: Public / User telemetry
- **Body**: `{ userId?: string, sessionId?: string, productId: string, interactionType: "VIEW" | "ADD_TO_CART" | "WISHLIST" | "SEARCH" | "ORDER_COMPLETED", metadata?: object }`
- **Side Effect**: Records interaction into PostgreSQL `user_interactions` and invalidates user cache.

### `POST /api/v1/analytics/events`

- **Auth**: Public / Telemetry
- **Body**: `{ eventType: "IMPRESSION" | "CLICK" | "ADD_TO_CART" | "PURCHASE", userId?: string, productId: string, strategy: string, shelf?: string, position?: number }`
- **Side Effect**: Logs event for strategy performance aggregation.

### `GET /api/v1/analytics/metrics`

- **Auth**: Admin / Scraper
- **Response**: Array of `StrategyMetricType` (`strategy`, `impressions`, `clicks`, `conversions`, `ctr`, `conversionRate`)

### `GET /health`, `GET /health/live`, `GET /health/ready`, `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Health status, liveness probe, readiness probe (PostgreSQL + Redis + Kafka), and Prometheus metric exposition format.

---

## 10. Cart Service (`:8009`)

### `GET /api/v1/cart`

- **Auth**: Authenticated user (Clerk JWT) or Guest (`x-guest-token` header / `guest_token` cookie)
- **Response**: `CartResponseType` — Complete cart object with items, estimated pricing totals, coupons, adjustments, and TTL.
- **Cache**: Redis active cart cache with write-through invalidation.

### `POST /api/v1/cart/items`

- **Auth**: Authenticated user or Guest
- **Body**: `{ "productId": string, "variantId"?: string, "quantity": number, "metadata"?: object }` (quantity 1–10)
- **Response**: `CartResponseType`
- **Side Effect**: Validates product/variant and stock via `product-service` & `inventory-service`, recalculates estimated totals, updates optimistic `version`, and publishes `cart.item_added`.

### `PATCH /api/v1/cart/items/:itemId`

- **Auth**: Authenticated user or Guest
- **Body**: `{ "quantity": number }` (quantity 1–10)
- **Response**: `CartResponseType`
- **Side Effect**: Updates item quantity atomically, recalculates estimated totals, and publishes `cart.item_updated`.

### `DELETE /api/v1/cart/items/:itemId`

- **Auth**: Authenticated user or Guest
- **Response**: `CartResponseType`
- **Side Effect**: Removes item from cart, recalculates estimated totals, and publishes `cart.item_removed`.

### `POST /api/v1/cart/merge`

- **Auth**: Authenticated user (Clerk JWT required)
- **Body**: `{ "guestToken": string }`
- **Response**: `CartResponseType`
- **Side Effect**: Transactionally combines guest cart items into authenticated user cart. Merges quantities for identical `productId` + `variantId`, caps at `MAX_ITEM_QUANTITY` (10) recording adjustment entries in `adjustments`, marks guest cart as `merged`, invalidates Redis caches, and publishes `cart.merged`.

### `DELETE /api/v1/cart`

- **Auth**: Authenticated user or Guest
- **Response**: `{ "success": true, "message": "Cart cleared successfully" }`
- **Side Effect**: Clears all items, coupons, and adjustments from cart, resets totals to 0, and publishes `cart.cleared`.

### `POST /api/v1/cart/coupons`

- **Auth**: Authenticated user or Guest
- **Body**: `{ "code": string }`
- **Response**: `CartResponseType`
- **Side Effect**: Evaluates coupon against minimum subtotal rules, records coupon into cart, recalculates estimated totals, and publishes `cart.coupon_added`.

### `DELETE /api/v1/cart/coupons/:code`

- **Auth**: Authenticated user or Guest
- **Response**: `CartResponseType`
- **Side Effect**: Removes applied coupon, recalculates estimated totals, and publishes `cart.coupon_removed`.

### `POST /api/v1/cart/refresh-pricing`

- **Auth**: Authenticated user or Guest
- **Response**: `CartResponseType`
- **Side Effect**: Re-validates current product prices and recalculates estimated totals, creating a new immutable pricing snapshot.

### `GET /api/v1/cart/summary`

- **Auth**: Authenticated user or Guest
- **Response**: `CartSummaryResponseType` — `{ "id": string, "itemCount": number, "subtotal": number, "grandTotal": number, "currency": string }`
- **Optimized**: Lightweight read for navbar badges and cart drawers without heavy population.

### `GET /health`, `GET /health/live`, `GET /health/ready`, `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Health status, MongoDB connection probe, Redis probe, Kafka probe, and Prometheus metrics exposition.

---

## 11. Media Service (`:8013`)

### `POST /api/v1/media/uploads`

- **Auth**: User (`shouldBeUser`)
- **Body**: `UploadRequestSchema` — `{ ownerType, ownerId, filename, contentType, size, category?, visibility? }`
- **Response**: `201` — `{ mediaId, uploadUrl, objectKey, bucket, expiresAt, media }` (`uploadUrl` is a short-lived presigned PUT)
- **Side Effect**: Creates the `PENDING` metadata row + upload session; binaries upload **directly** to S3/MinIO — never through this API
- **Errors**: `MediaTooLargeError` (per-category limits), `MediaTypeNotSupportedError` (MIME allowlist), `ForbiddenError` (cross-owner), `ValidationError`

### `POST /api/v1/media/:mediaId/complete`

- **Auth**: User (owner)
- **Response**: `MediaResponseType` — media now in `PROCESSING`
- **Side Effect**: Verifies the stored object (existence, size re-read from storage, extension/MIME consistency), transitions `PENDING → UPLOADING → PROCESSING`, publishes `media.uploaded`, enqueues the Sharp job
- **Errors**: `ConflictError` (session missing/expired/completed), `UploadError` (object absent), `MediaTooLargeError`, `MediaTypeNotSupportedError` (quarantines the media)

### `POST /api/v1/media/:mediaId/abort`

- **Auth**: User (owner) or Admin
- **Response**: `{ success: true, message: "Upload session aborted" }`
- **Side Effect**: Marks upload session aborted and transitions media status to `FAILED`, preventing subsequent completion
- **Errors**: `NotFoundError` (session or media not found), `ForbiddenError` (caller is not owner or admin)

### `GET /api/v1/media/:mediaId`

- **Auth**: Public (PRIVATE requires owner/admin, enforced in the service)
- **Response**: `MediaResponseType`

### `GET /api/v1/media/:mediaId/url?variant=`

- **Auth**: User
- **Query Params**: `variant` (optional; generated set per upload category)
- **Response**: `{ mediaId, variant, url, expiresIn }` — unsigned public URL for PUBLIC media, presigned for PRIVATE
- **Errors**: `MediaNotReadyError` (media not `READY`), `NotFoundError`

### `GET /api/v1/media/owner/:ownerType/:ownerId`

- **Auth**: Public (PRIVATE entries filtered by actor)
- **Query Params**: `limit` (≤ 200, default 50), `offset`
- **Response**: `{ items: MediaResponseType[], total: number }` — READY media for an owner

### `POST /api/v1/media/resolve`

- **Auth**: Public (rate-limited)
- **Body**: `MediaResolveRequestSchema` — `{ ids: string[] }`
- **Response**: `{ items: Array<{ id, url, ... }> }` — batch-resolves media references to URLs; unknown ids and raw URLs pass through unchanged; unresolved ids negative-cached
- **Cache**: Redis batch + per-entry keys, TTL-bounded, invalidated on READY/quarantine/soft-delete/restore/owner-reassignment/purge

### `DELETE /api/v1/media/:mediaId`

- **Auth**: User (owner)
- **Response**: `{ message: "Media deleted" }` — soft delete; binaries survive the 7-day recovery window
- **Side Effect**: Publishes `media.deleted`, invalidates resolve cache

### `GET /api/v1/admin/media`

- **Auth**: Admin (`shouldBeAdmin`)
- **Query Params**: `status`, `ownerType`, `ownerId`, `limit`, `offset`
- **Response**: `{ items, total }` — media across all owners

### `POST /api/v1/admin/media/:mediaId/reprocess`

- **Auth**: Admin
- **Response**: `202` — `{ message: "Reprocessing queued", jobId }` — re-enqueues the Sharp variant job

### `POST /api/v1/admin/media/:mediaId/restore`

- **Auth**: Admin
- **Response**: `{ message: "Media restored" }` — undo soft delete (status back to `READY`)
- **Errors**: `NotFoundError`

### `DELETE /api/v1/admin/media/:mediaId/purge`

- **Auth**: Admin
- **Response**: `{ message: "Media purged" }` — permanent binary + variant + metadata removal

### `GET /health`, `GET /health/live`, `GET /health/ready`, `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Health status, PostgreSQL probe, Redis probe, storage (S3/MinIO) connectivity probe, and Prometheus metrics exposition.
- **Note**: `media-worker` (Sharp variants) and `media-cleanup` (session expiry, stale-job requeue, purge GC) run as separate containers with no HTTP surface.

---

## 12. Review Service (`:8014`)

### `GET /api/v1/products/:productId/reviews`

- **Auth**: Public
- **Query Params**: `page` (default 1), `limit` (default 10), `sort` (`newest`, `highest_rating`, `lowest_rating`, `most_helpful`), `rating` (1-5 filter), `verifiedOnly` (`true`/`false`), `hasMedia` (`true`/`false`)
- **Response**: `{ reviews: ReviewType[], total: number, page: number, totalPages: number }`

### `GET /api/v1/products/:productId/rating-summary`

- **Auth**: Public
- **Response**: `ProductRatingSummaryType` — `{ productId, averageRating, totalReviews, verifiedPurchasesCount, distribution: { [1..5]: number } }`
- **Cache**: Redis read-through cache (`review:summary:<productId>`) with write-through invalidation and Kafka broadcast.

### `GET /api/v1/reviews/:reviewId`

- **Auth**: Public
- **Response**: Single review object including author info, verified purchase badge, media list, and seller response thread.

### `POST /api/v1/products/:productId/reviews`

- **Auth**: User (`shouldBeUser`)
- **Body**: `{ rating: number (1-5), title?: string, content: string, mediaIds?: string[] }`
- **Response**: `201 Created` — `{ review: ReviewType }`
- **Enforcement**: Checks database `purchase_eligibility` table derived from consumed `order.delivered` / `shipment.delivered` events. If customer has not purchased or already reviewed this product, rejects with `403 Forbidden` / `409 Conflict`.
- **Side Effect**: Publishes `review.created` Kafka event, triggers rating summary recalculation, and publishes `product.rating-summary.updated`.

### `GET /api/v1/me/reviews`

- **Auth**: User (`shouldBeUser`)
- **Response**: `{ reviews: ReviewType[] }` — all reviews submitted by the authenticated user.

### `PATCH /api/v1/reviews/:reviewId`

- **Auth**: User (owner)
- **Body**: `{ rating?: number, title?: string, content?: string }`
- **Response**: `{ review: ReviewType }`
- **Side Effect**: Publishes `review.updated` Kafka event and updates rating summary.

### `DELETE /api/v1/reviews/:reviewId`

- **Auth**: User (owner) or Admin (`shouldBeAdmin`)
- **Response**: `{ success: true, message: "Review deleted" }`
- **Side Effect**: Publishes `review.deleted` Kafka event, recalculates product rating summary, and invalidates Redis cache.

### `POST /api/v1/reviews/:reviewId/votes`

- **Auth**: User (`shouldBeUser`)
- **Body**: `{ isHelpful: boolean }`
- **Response**: `{ success: true, helpfulCount: number, unhelpfulCount: number }`
- **Anti-Abuse**: Prevents author self-voting; atomic transitions if changing from helpful to unhelpful.

### `POST /api/v1/reviews/:reviewId/reports`

- **Auth**: User (`shouldBeUser`)
- **Body**: `{ reason: string, details?: string }`
- **Response**: `201 Created` — `{ message: "Review reported" }`
- **Side Effect**: Publishes `review.reported` event. Automatically flags reviews with 5+ distinct reports for moderation.

### `POST /api/v1/reviews/:reviewId/response`

- **Auth**: Seller / Admin (`shouldBeAdmin` or authorized seller)
- **Body**: `{ content: string }`
- **Response**: `201 Created` — `{ response: SellerResponseType }`

### `GET /api/v1/admin/reviews/pending`

- **Auth**: Admin (`shouldBeAdmin`)
- **Query Params**: `page`, `limit`
- **Response**: Moderation queue of flagged and pending reviews.

### `POST /api/v1/admin/reviews/:reviewId/moderate`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `{ action: "APPROVE" | "REJECT", notes?: string }`
- **Response**: `{ success: true, status: string }`
- **Side Effect**: Publishes `review.approved` or `review.rejected` event.

### `GET /health`, `GET /ready`, `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Health liveness, PostgreSQL + Redis readiness probes, and Prometheus metrics exposition.

---

## 17. Wishlist Service (`:8015`)

### `GET /api/v1/me/wishlists`

- **Auth**: User (`shouldBeUser`) or Guest token (`x-guest-token`)
- **Response**: `{ wishlists: Wishlist[] }` — retrieves customer wishlists; automatically initializes default wishlist if none exists.

### `POST /api/v1/me/wishlists`

- **Auth**: User (`shouldBeUser`)
- **Body**: `{ name: string, visibility?: "PUBLIC" | "PRIVATE" | "SHARED" }`
- **Response**: `201 Created` — `{ wishlist: Wishlist }`
- **Side Effect**: Publishes `wishlist.created` Kafka event.

### `GET /api/v1/me/wishlists/:wishlistId`

- **Auth**: User (`shouldBeUser`) or Guest token (`x-guest-token`)
- **Response**: `{ wishlist: Wishlist, items: WishlistItem[] }`

### `PATCH /api/v1/me/wishlists/:wishlistId`

- **Auth**: User (`shouldBeUser`)
- **Body**: `{ name?: string, visibility?: "PUBLIC" | "PRIVATE" | "SHARED" }`
- **Response**: `{ wishlist: Wishlist }`
- **Side Effect**: Publishes `wishlist.updated` Kafka event.

### `DELETE /api/v1/me/wishlists/:wishlistId`

- **Auth**: User (`shouldBeUser`)
- **Response**: `{ success: true, message: "Wishlist deleted" }`
- **Side Effect**: Cascades item deletions and publishes `wishlist.deleted` Kafka event.

### `POST /api/v1/me/wishlists/:wishlistId/items`

- **Auth**: User (`shouldBeUser`) or Guest token (`x-guest-token`)
- **Body**: `{ productId: number, variantId?: string, addedPrice?: number, inStock?: boolean }`
- **Response**: `201 Created` — `{ item: WishlistItem }`
- **Duplicate Prevention**: Rejects duplicate additions within the same wishlist.
- **Side Effect**: Publishes `wishlist.item.added` and `wishlist.product_added` (recommendation score weight 4.0) Kafka events.

### `DELETE /api/v1/me/wishlists/:wishlistId/items/:itemId`

- **Auth**: User (`shouldBeUser`) or Guest token (`x-guest-token`)
- **Response**: `{ success: true, message: "Item removed" }`
- **Side Effect**: Publishes `wishlist.item.removed` Kafka event.

### `DELETE /api/v1/me/wishlists/:wishlistId/items` (Bulk Removal)

- **Auth**: User (`shouldBeUser`) or Guest token (`x-guest-token`)
- **Body**: `{ itemIds?: string[] }` (omitting `itemIds` clears the entire wishlist)
- **Response**: `{ success: true, removedCount: number }`

### `POST /api/v1/me/wishlists/:wishlistId/items/move`

- **Auth**: User (`shouldBeUser`)
- **Body**: `{ itemId: string, targetWishlistId: string }`
- **Response**: `{ success: true, movedItem: WishlistItem }`
- **Side Effect**: Publishes `wishlist.item.moved` Kafka event.

### `POST /api/v1/me/wishlists/merge`

- **Auth**: User (`shouldBeUser`) with guest token header (`x-guest-token`)
- **Body**: `{ guestId: string }`
- **Response**: `{ success: true, mergedCount: number, wishlistId: string }`
- **Side Effect**: Merges guest items into authenticated account's default wishlist; publishes `wishlist.merged` Kafka event.

### `POST /api/v1/me/wishlists/:wishlistId/share`

- **Auth**: User (`shouldBeUser`)
- **Body**: `{ permission?: "VIEW" | "EDIT", expiresInDays?: number }`
- **Response**: `{ shareToken: string, shareUrl: string, permission: string, expiresAt?: string }`
- **Security**: Generates 64-character unguessable crypto token cached in Redis for fast access control.

### `GET /api/v1/shared-wishlists/:shareToken`

- **Auth**: Public (Unguessable token)
- **Response**: `{ wishlist: PublicWishlist, items: WishlistItem[], permission: string }`
- **Access Control**: Validates token validity and expiration without exposing internal private wishlist IDs.

### `GET /api/v1/admin/wishlists/overview`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `{ totalWishlists: number, totalItems: number, priceDropAlerts: number, restockAlerts: number, topProducts: Array<{ productId: number, count: number }> }`

### `GET /api/v1/admin/wishlists`

- **Auth**: Admin (`shouldBeAdmin`)
- **Query Params**: `page` (default 1), `limit` (default 20, max 100), `search` (optional)
- **Response**: `{ wishlists: Array<Wishlist & { itemsCount: number }>, pagination: { page: number, limit: number, total: number, totalPages: number } }`

### `GET /health`, `GET /ready`, `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Liveness probe, readiness probe (verifies PostgreSQL `larekmart_wishlist_db` and Redis connectivity), and Prometheus metrics exposition.

---

## 13. Promotion Service (`:8016`)

### `GET /api/v1/promotions/active`

- **Auth**: Public / Optional User or Guest
- **Query Params**: `type` (`CAMPAIGN` | `COUPON` | `FLASH_SALE` | `AUTOMATIC`), `scope` (`ORDER` | `PRODUCT` | `CATEGORY` | `SHIPPING`)
- **Response**: `{ promotions: PromotionWithDetails[] }`
- **Caching**: Cached in Redis (`promotion:v1:active:*`) with 60-second TTL.

### `POST /api/v1/promotions/quote`

- **Auth**: Optional User or Guest
- **Body**: `PromotionEvaluationContextSchema` (`cartItems`, `subtotal`, `shippingFee`, `couponCode?`, `customerSegment?`, `currency?`)
- **Response**: `PromotionQuoteResult` (`eligiblePromotions`, `totalDiscount`, `netSubtotal`, `shippingDiscount`, `freeShipping`, `appliedCouponCode`, `breakdown`)
- **Evaluation**: Validates minimum order amounts, target product/category matching, coupon validity, usage limits, and stacking rules.

### `POST /api/v1/promotions/validate-coupon`

- **Auth**: Optional User or Guest
- **Body**: `{ code: string, cartTotal?: number }`
- **Response**: `{ valid: boolean, message?: string, coupon?: CouponCode, promotion?: PromotionWithDetails }`

### `POST /api/v1/promotions/reserve`

- **Auth**: Authenticated User or Internal Service (`shouldBeUser`)
- **Body**: `ReservePromotionInputSchema` (`orderId`, `promotionId`, `couponCode?`, `discountAmount`, `currency?`, `ttlSeconds?`)
- **Response**: `201 Created` — `{ success: true, reservation: PromotionReservation }`
- **Lifecycle**: Creates a transactional 15-minute `PENDING` hold on campaign budget and customer redemption limit. Idempotent by `orderId`.

### `POST /api/v1/promotions/commit`

- **Auth**: Authenticated User or Internal Service (`shouldBeUser`)
- **Body**: `CommitPromotionInputSchema` (`orderId`, `finalDiscountAmount?`)
- **Response**: `{ success: true, redemptions: PromotionRedemption[] }`
- **Lifecycle**: Transitions `PENDING` reservations to `COMMITTED`, records immutable redemption audit logs, and increments lifetime campaign redemptions.

### `POST /api/v1/promotions/release`

- **Auth**: Authenticated User or Internal Service (`shouldBeUser`)
- **Body**: `ReleasePromotionInputSchema` (`orderId`, `reason?`)
- **Response**: `{ success: true, message: "Promotion reservations released" }`
- **Lifecycle**: Marks reservations `RELEASED`, releasing budget holds and customer usage counters.

### `GET /api/v1/admin/promotions`

- **Auth**: Admin (`shouldBeAdmin`)
- **Query Params**: `page`, `limit`, `status`, `type`
- **Response**: `{ promotions: PromotionWithDetails[], pagination: PaginationMeta }`

### `POST /api/v1/admin/promotions`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `CreatePromotionInputSchema` (`name`, `description`, `type`, `discountType`, `discountValue`, `scope`, `rules`, `targets`, `budget`, `startDate`, `endDate`)
- **Response**: `201 Created` — `{ promotion: PromotionWithDetails }`
- **Side Effect**: Emits `promotion.created` Kafka event and invalidates active promotions cache.

### `GET /api/v1/admin/promotions/:id`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `{ promotion: PromotionWithDetails }`

### `PATCH /api/v1/admin/promotions/:id`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `UpdatePromotionInputSchema`
- **Response**: `{ promotion: PromotionWithDetails }`
- **Side Effect**: Emits `promotion.activated` / updated events and updates cache.

### `POST /api/v1/admin/promotions/:id/deactivate`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `{ success: true, promotion: PromotionWithDetails }`
- **Side Effect**: Sets status to `DEACTIVATED`, emits `promotion.deactivated` Kafka event.

### `POST /api/v1/admin/promotions/:id/coupons`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `CreateCouponInputSchema` (`code`, `maxUsesPerCustomer?`, `maxTotalUses?`, `expiresAt?`)
- **Response**: `201 Created` — `{ coupon: CouponCode }`

### `GET /api/v1/admin/promotions/:id/redemptions`

- **Auth**: Admin (`shouldBeAdmin`)
- **Query Params**: `page`, `limit`
- **Response**: `{ redemptions: PromotionRedemption[], pagination: PaginationMeta }`

### `GET /api/v1/admin/promotions/overview`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `{ totalActivePromotions: number, totalCouponsIssued: number, totalDiscountsAwarded: number, totalRedemptions: number }`

### `GET /health`, `GET /health/live`, `GET /health/ready`, `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Liveness probe, readiness probe (verifying PostgreSQL `larekmart_promotion_db` and Redis connectivity), and Prometheus metrics exposition.

---

## tax-service (:8017)

### `POST /api/v1/tax/quote`

- **Auth**: Public / Guest or Authenticated User
- **Body**: `TaxQuoteRequestSchema` (`jurisdiction`, `items`: `[{ id, categoryId, amount, quantity }]`, `customerId?`)
- **Response**: `{ subtotal: string, taxTotal: string, grandTotal: string, lines: TaxLineQuote[] }` — estimated sales tax / VAT without persisting calculation snapshot

### `POST /api/v1/tax/calculate`

- **Auth**: User or Internal Service (`order.created` consumer or direct call)
- **Body**: `TaxCalculateRequestSchema` (`orderId`, `jurisdiction`, `items`, `customerId?`, `exemptionCertificateId?`)
- **Response**: `201 Created` — `{ calculationId: string, orderId: string, taxTotal: string, status: "COMMITTED" }` — immutable calculation snapshot persisted in MySQL `tax_db`
- **Side Effect**: Emits `tax.calculation.completed` Kafka event

### `GET /api/v1/tax/calculations/:calculationId`

- **Auth**: User (order owner) or Admin
- **Response**: Full auditable tax calculation record with rule version and jurisdiction breakdown

### `POST /api/v1/tax/returns/quote`

- **Auth**: Authenticated User or Internal Service (`return-service`)
- **Body**: `{ calculationId: string, returnedItems: [{ itemId: string, quantity: number }] }`
- **Response**: `{ proportionalTaxRefund: string, lines: TaxReturnLineQuote[] }` — exact decimal proportional tax adjustment for partial returns

### `GET /api/v1/tax/jurisdictions`

- **Auth**: Public
- **Response**: Supported jurisdictions (e.g., `US-CA`, `US-NY`, `PK-ISB`, `GB`)

### `GET /api/v1/tax/categories`

- **Auth**: Public
- **Response**: Configured product tax categories (standard, apparel, digital, food, exempt)

### `POST /api/v1/admin/tax/rules`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `CreateTaxRuleSchema` (`jurisdictionId`, `categoryId`, `rate`, `effectiveFrom`, `effectiveTo?`, `description`)
- **Response**: `201 Created` — `{ rule: TaxRule }`
- **Side Effect**: Emits `tax.rules.updated` Kafka event and invalidates Redis rule cache

### `PATCH /api/v1/admin/tax/rules/:ruleId`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `UpdateTaxRuleSchema`
- **Response**: `{ rule: TaxRule }`

### `POST /api/v1/admin/tax/exemptions`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `CreateTaxExemptionSchema` (`customerId`, `jurisdictionId`, `certificateNumber`, `expiresAt`)
- **Response**: `201 Created` — `{ exemption: TaxExemption }`

---

## return-service (:8018)

All requests route through `api-gateway` on port `8080`.

### `POST /api/v1/returns/orders/:orderId`

- **Auth**: Authenticated User (`shouldBeUser`)
- **Body**: `CreateReturnRequestSchema` (`items`: `[{ orderItemId, quantity, reason, condition? }]`, `customerNotes?`, `evidenceMediaIds?`)
- **Response**: `201 Created` — `{ success: true, return: ReturnWithDetails }`
- **Verification**: Enforces 14-day return window from `order.delivered`, validates delivered quantities, checks final-sale exclusions, and calculates prorated refund estimates
- **Side Effect**: Emits `return.requested` via transactional outbox

### `GET /api/v1/returns`

- **Auth**: Authenticated User (`shouldBeUser`)
- **Query Params**: `page` (default 1), `limit` (default 20), `status?`
- **Response**: `{ items: ReturnSummary[], pagination: PaginationMeta }` — caller's returns scoped strictly by `x-user-id`

### `GET /api/v1/returns/:returnId`

- **Auth**: Authenticated User (owner) or Admin
- **Response**: `{ return: ReturnWithDetails }` — comprehensive return details including items, tracking, inspections, and refund status

### `DELETE /api/v1/returns/:returnId`

- **Auth**: Authenticated User (owner)
- **Response**: `{ success: true, message: "Return cancelled" }`
- **Condition**: Only returns in `REQUESTED` status can be cancelled by customers
- **Side Effect**: Emits `return.cancelled` via transactional outbox

### `POST /api/v1/returns/:returnId/evidence`

- **Auth**: Authenticated User (owner)
- **Body**: `AttachEvidenceSchema` (`mediaId`: string, `mediaUrl`: string, `mediaType`: "IMAGE" | "VIDEO", `description?`: string)
- **Response**: `201 Created` — `{ success: true, evidence: ReturnMedia }`

### `POST /api/v1/returns/:returnId/tracking`

- **Auth**: Authenticated User (owner)
- **Body**: `SubmitTrackingSchema` (`carrier`: string, `trackingNumber`: string, `shippedAt?`: string)
- **Response**: `{ success: true, shipment: ReturnShipment }`
- **Side Effect**: Transitions return status to `IN_TRANSIT`

### `GET /api/v1/admin/returns`

- **Auth**: Admin (`shouldBeAdmin`)
- **Query Params**: `page`, `limit`, `status`, `orderId`, `customerId`, `startDate`, `endDate`
- **Response**: `{ items: ReturnWithDetails[], pagination: PaginationMeta, statistics: ReturnKPIs }`

### `GET /api/v1/admin/returns/:returnId`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `{ return: ReturnWithDetails }`

### `POST /api/v1/admin/returns/:returnId/approve`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `ApproveReturnSchema` (`rmaNumber?`, `instructions?`, `estimatedRefundAmount?`)
- **Response**: `{ success: true, return: ReturnWithDetails }`
- **Side Effect**: Generates formal RMA, transitions to `APPROVED`, emits `return.approved` and `return.shipment.requested` (triggering `shipping-service` return label)

### `POST /api/v1/admin/returns/:returnId/reject`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `RejectReturnSchema` (`reason`: string, `notes?`: string)
- **Response**: `{ success: true, return: ReturnWithDetails }`
- **Side Effect**: Transitions to `REJECTED`, emits `return.rejected` (triggering customer notification email)

### `POST /api/v1/admin/returns/:returnId/inspect`

- **Auth**: Admin or Warehouse Inspector (`shouldBeAdmin`)
- **Body**: `RecordInspectionSchema` (`items`: `[{ returnItemId, condition, disposition, restockQuantity, scrapQuantity, notes? }]`)
- **Response**: `{ success: true, return: ReturnWithDetails, inspection: ReturnInspection }`
- **Disposition Options**: `RESTOCK_SELLABLE`, `RESTOCK_REFURBISHED`, `DAMAGED_SCRAP`, `RETURN_TO_VENDOR`
- **Side Effect**: Emits `return.inspection.completed` (restocking in `inventory-service`) and `return.refund.requested` (triggering Stripe refund SAGA in `payment-service`)

### `POST /api/v1/admin/returns/:returnId/refund/retry`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `{ success: true, message: "Refund retry initiated", return: ReturnWithDetails }`
- **Condition**: Permitted when return status is `REFUND_FAILED`
- **Side Effect**: Re-emits `return.refund.requested` to re-execute Stripe refund SAGA

### `GET /health`, `GET /ready`, `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Liveness probe, readiness probe (verifying MySQL `return_db` and Redis connectivity), and Prometheus metrics exposition.

---

## 15. Vendor Service (`:8020`)

### `POST /api/v1/vendors`

- **Auth**: User (`shouldBeUser`)
- **Body**: `CreateVendorSchema` (`legalName`, `tradeName?`, `country`, `registrationNumber?`, `taxIdentificationNumber?`)
- **Response**: `{ vendor: VendorWithProfile }`
- **Side Effect**: Emits `vendor.registered` Kafka event

### `GET /api/v1/vendors/me`

- **Auth**: User (`shouldBeUser`)
- **Response**: `{ vendor: VendorWithProfile | null }`

### `GET /api/v1/vendors/:id`

- **Auth**: User (`shouldBeUser`)
- **Response**: `{ vendor: VendorWithProfile }`

### `PATCH /api/v1/vendors/:id`

- **Auth**: User (`shouldBeUser`)
- **Body**: `UpdateVendorSchema` (`tradeName?`, `contactEmail?`, `contactPhone?`)
- **Response**: `{ vendor: VendorWithProfile }`

### `GET /api/v1/vendors/:id/business-profile`

- **Auth**: User (`shouldBeUser`)
- **Response**: `{ businessProfile: VendorBusinessProfile }`

### `PUT /api/v1/vendors/:id/business-profile`

- **Auth**: User (`shouldBeUser`)
- **Body**: `UpsertVendorBusinessProfileSchema` (`website?`, `businessAddress`, `supportEmail?`, `bankDetails?`)
- **Response**: `{ businessProfile: VendorBusinessProfile }`

### `POST /api/v1/vendors/:id/documents`

- **Auth**: User (`shouldBeUser`)
- **Body**: `UploadVendorDocumentSchema` (`documentType`, `mediaId`, `fileName?`, `metadata?`)
- **Response**: `{ document: VendorDocument }`
- **Side Effect**: Emits `vendor.document_uploaded` Kafka event

### `GET /api/v1/vendors/:id/documents`

- **Auth**: User (`shouldBeUser`)
- **Response**: `{ documents: VendorDocument[] }`

### `POST /api/v1/vendors/:id/verifications`

- **Auth**: User (`shouldBeUser`)
- **Body**: `RequestVerificationSchema` (`workflowType?`)
- **Response**: `{ verification: VendorVerification }`
- **Side Effect**: Transitions status to `PENDING_VERIFICATION`, emits `vendor.verification.requested`

### `GET /api/v1/admin/vendors`

- **Auth**: Admin (`shouldBeAdmin`)
- **Query Params**: `page`, `limit`, `status`, `search`
- **Response**: `{ items: VendorListItem[], total: number, page: number, totalPages: number }`

### `GET /api/v1/admin/vendors/verifications/pending`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `{ pending: VendorVerificationListItem[] }`

### `POST /api/v1/admin/vendors/:id/verify`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `AdminVerifyVendorSchema` (`decision`: `"APPROVE"` | `"REJECT"`, `rejectionReason?`, `reviewerNotes?`)
- **Response**: `{ success: true, vendor: VendorWithProfile }`
- **Side Effect**: Emits `vendor.verified` or `vendor.rejected` Kafka event (triggering `user-service` to promote `isSeller: true` on approval)

### `POST /api/v1/admin/vendors/:id/status`

- **Auth**: Admin (`shouldBeAdmin`)
- **Body**: `AdminUpdateVendorStatusSchema` (`status`: `"ACTIVE"` | `"SUSPENDED"` | `"BANNED"`, `reason?`)
- **Response**: `{ success: true, vendor: VendorWithProfile }`
- **Side Effect**: Emits `vendor.suspended` or `vendor.reactivated` Kafka event

---

## 16. Seller Service (`:8021`)

### `GET /api/v1/system-settings`

- **Auth**: Public
- **Response**: `{ isSellerEnabled: boolean, platformFeePercentage: number, requireVendorVerification: boolean, allowDirectStoreRegistration: boolean }`

### `GET /api/v1/admin/system-settings`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `{ settings: SystemSettings }`

### `PATCH /api/v1/admin/system-settings`

- **Auth**: Super Admin (`shouldBeAdmin`, verifies role `super_admin` or `isSuperAdmin: true`)
- **Body**: `UpdateSystemSettingsSchema` (`isSellerEnabled?`, `platformFeePercentage?`, `requireVendorVerification?`, `allowDirectStoreRegistration?`)
- **Response**: `{ success: true, settings: SystemSettings }`
- **Side Effect**: Updates database and invalidates Redis key `marketplace:system_settings`

### `GET /api/v1/admin/delegations`

- **Auth**: Super Admin or Manage Admin (`shouldBeAdmin`, verifies `super_admin` or `x-user-can-manage-sellers: true`)
- **Response**: `{ delegations: AdminDelegationItem[] }`

### `POST /api/v1/admin/delegations`

- **Auth**: Super Admin (`shouldBeAdmin`, strictly requires `super_admin` or `isSuperAdmin: true`)
- **Body**: `GrantDelegationSchema` (`adminUserId`, `scope`: `"manage_sellers"`, `notes?`)
- **Response**: `{ success: true, delegation: AdminDelegationItem }`

### `DELETE /api/v1/admin/delegations/:adminUserId/:scope`

- **Auth**: Super Admin (`shouldBeAdmin`, strictly requires `super_admin` or `isSuperAdmin: true`)
- **Response**: `{ success: true, message: "Delegation revoked" }`

### `POST /api/v1/sellers`

- **Auth**: User (`shouldBeUser`)
- **Body**: `CreateSellerSchema` (`vendorId`, `storeName`, `slug`, `contactEmail`, `contactPhone?`)
- **Response**: `{ seller: SellerWithStore }`
- **Side Effect**: Emits `seller.created` Kafka event (triggering `user-service` to promote `isSeller: true`)

### `GET /api/v1/sellers/me`

- **Auth**: User (`shouldBeUser`)
- **Response**: `{ sellers: SellerWithStore[] }`

### `GET /api/v1/storefronts/:slug`

- **Auth**: Public
- **Response**: `{ storefront: StorefrontPublicProfile }` (Served read-through cached via Redis `seller:v1:*`)

### `GET /api/v1/admin/sellers`

- **Auth**: Admin or Delegated Manage Admin (`shouldBeAdmin`, accepts Super Admin or `x-user-can-manage-sellers: true`)
- **Query Params**: `page`, `limit`, `status`, `search`
- **Response**: `{ items: SellerListItem[], total: number, page: number, totalPages: number }`

### `POST /api/v1/admin/sellers/:id/status`

- **Auth**: Admin or Delegated Manage Admin (`shouldBeAdmin`, accepts Super Admin or `x-user-can-manage-sellers: true`)
- **Body**: `AdminUpdateSellerStatusSchema` (`status`: `"ACTIVE"` | `"SUSPENDED"` | `"PENDING"` | `"TERMINATED"`, `reason?`)
- **Response**: `{ success: true, seller: SellerWithStore }`
- **Side Effect**: Emits `seller.activated` or `seller.suspended` Kafka event
