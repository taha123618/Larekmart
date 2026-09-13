# API Registry & Service Endpoints

Comprehensive catalog of all HTTP endpoints exposed by Larekmart backend services.

## Service Ports & Protocols

| Service            | Port   | Framework      | Auth Guard                         | Owner                        |
| ------------------ | ------ | -------------- | ---------------------------------- | ---------------------------- |
| `product-service`  | `8000` | Express 5      | `shouldBeUser` / `shouldBeAdmin`   | Product & Category Catalog   |
| `order-service`    | `8001` | Fastify 5      | `shouldBeUser` / `shouldBeAdmin`   | Order Management & Analytics |
| `payment-service`  | `8002` | Hono 4         | `shouldBeUser` / Webhook Signature | Stripe Checkout & Webhooks   |
| `auth-service`     | `8003` | Express 5      | `shouldBeAdmin`                    | Admin User Management Proxy  |
| `analytic-service` | `8004` | Express 5      | `shouldBeAdmin`                    | Analytics & KPI Aggregations |
| `email-service`    | —      | Node.js Worker | None (Kafka only)                  | Transactional Email Dispatch |

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

### `GET /analytics/summary`

- **Auth**: Admin (`shouldBeAdmin`)
- **Response**: `AnalyticsSummaryType` (gross revenue, order counts, signups, products created/deleted)

### `GET /analytics/daily-chart`

- **Auth**: Admin (`shouldBeAdmin`)
- **Query Params**: `days` (number, default: 30)
- **Response**: `AnalyticsDailyChartType[]`

### `GET /analytics/events`

- **Auth**: Admin (`shouldBeAdmin`)
- **Query Params**: `limit` (number, default: 20)
- **Response**: `AnalyticsEventType[]`

### `GET /health`

- **Auth**: Public
- **Response**: Multi-dependency health report (Memory + PostgreSQL pool query)

### `GET /metrics`

- **Auth**: Public / Scraper
- **Response**: Prometheus text exposition format

---

## 6. Notification Service (`:8005`)

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
