# Functional Requirement Document (FRD) — Larekmart E-Commerce Platform

## 1. Functional Scope & State Machines

This document specifies the exact behavioral logic, state machine transitions, event interactions, and validation schemas across all Larekmart services.

---

## 2. Core State Machines

### 2.1 Order Lifecycle State Machine

```
   [Checkout Started]
           │
           ▼
   (Stripe Session Created) ───────────▶ [Abandoned / Expired]
           │
           ▼ (checkout.session.completed webhook)
   [payment.successful emitted]
           │
           ├───────────────────────────────┐
           ▼ (order-service)               ▼ (analytic-service)
     [Order Created]                 [Metrics Updated]
     (Status: "success")             (Revenue & Daily Summary)
           │
           ▼ (order.created emitted)
   [email-service Receipt Dispatched]
```

### 2.2 Product Catalog Sync State Machine

```
   [Admin Submits Product] ──▶ [product-service (PostgreSQL)] ──▶ [product.created emitted]
                                                                        │
                                   ┌────────────────────────────────────┴────────────────────────┐
                                   ▼                                                             ▼
                       [payment-service]                                             [analytic-service]
                       (stripe.products.create)                                      (Catalog Growth Metrics)
```

---

## 3. Microservice Functional Specifications

### 3.1 Product Service (`apps/product-service`)

#### FR-PROD-01: Product Catalog Management

- **`GET /products`**: Returns paginated list of products. Supports query parameters `category` (slug), `search` (case-insensitive name match), `sort` (`asc` | `desc`), `page` (default 1), `limit` (default 10).
- **`GET /products/:id`**: Returns individual product by numeric ID with relations (`Category`).
- **`POST /products`**: Requires `shouldBeAdmin`. Validates payload against `ProductFormSchema`. Creates database row in PostgreSQL via Prisma. Publishes `product.created` Kafka event (`{ value: { id, name, price } }`).
- **`PUT /products/:id`**: Requires `shouldBeAdmin`. Updates product fields.
- **`DELETE /products/:id`**: Requires `shouldBeAdmin`. Deletes product from PostgreSQL and publishes `product.deleted` Kafka event (`{ value: id }`).

#### FR-PROD-02: Category Management

- **`GET /categories`**: Returns all category records.
- **`POST /categories`**: Requires `shouldBeAdmin`. Validates and creates category.

---

### 3.2 Order Service (`apps/order-service`)

#### FR-ORD-01: Order Ingestion via Kafka

- **Topic Subscription**: Consumes `payment.successful` (and alias `payment-successful`).
- **Processing Logic**: Validates payload structure, instantiates Mongoose `Order` document with `userId`, `email`, `amount`, `status: "success"`, `products: [...]`.
- **Side Effect**: Emits `order.created` Kafka event (`{ value: { email, amount, status } }`).

#### FR-ORD-02: Order Retrieval & Chart Analytics

- **`GET /user-orders`**: Requires `shouldBeUser`. Returns orders matching `userId` from Clerk session.
- **`GET /orders`**: Requires `shouldBeAdmin`. Returns all orders sorted by `createdAt` descending.
- **`GET /order-chart`**: Requires `shouldBeAdmin`. Aggregates orders over past 6 months into month-by-month totals (`total` and `successful`).

---

### 3.3 Payment Service (`apps/payment-service`)

#### FR-PAY-01: Custom Checkout Session Creation

- **`POST /sessions/create-checkout-session`**: Requires `shouldBeUser`. Validates `cart` items (`{ id, quantity, price }[]`). Retrieves Stripe price IDs and generates Stripe checkout session with `ui_mode: "custom"`. Returns `{ clientSecret }`.

#### FR-PAY-02: Stripe Webhook Handling

- **`POST /webhooks/stripe`**: Verifies `stripe-signature` header against `STRIPE_WEBHOOK_SECRET`.
- **Event Handling**: On `checkout.session.completed`, extracts customer email, metadata, line items, and total amount. Emits `payment.successful` event into Kafka.

#### FR-PAY-03: Stripe Product Catalog Mirroring

- **Kafka Handlers**:
  - `product.created`: Calls `stripe.products.create` and `stripe.prices.create`.
  - `product.deleted`: Archives product in Stripe catalog.

---

### 3.4 Identity & Admin Proxy Service (`apps/auth-service`)

#### FR-AUTH-01: Admin User Management

- **`GET /users`**: Requires `shouldBeAdmin`. Proxies request to `clerkClient.users.getUserList()`.
- **`POST /users`**: Requires `shouldBeAdmin`. Validates against `UserFormSchema`. Creates Clerk user account via SDK and emits `user.created` event into Kafka (`{ value: { username, email } }`).
- **`DELETE /users/:id`**: Requires `shouldBeAdmin`. Deletes user via Clerk SDK.

---

### 3.5 Transactional Notification Service (`apps/email-service`)

#### FR-EML-01: Welcome Email Dispatch

- **Topic Subscription**: `user.created`. Sends transactional welcome HTML email via Nodemailer with Gmail OAuth2 transport.

#### FR-EML-02: Order Receipt Dispatch

- **Topic Subscription**: `order.created`. Formats order receipt and sends confirmation email to customer email address.

---

### 3.6 Analytics & Metrics Service (`apps/analytic-service`)

#### FR-ANA-01: Event Stream Aggregation

- Subscribes to all event topics (`payment.successful`, `order.created`, `user.created`, `product.created`, `product.deleted`).
- Ingests events into `analytics_events` and aggregates daily totals into `analytics_daily_summary`.
- Graceful in-memory fallback maintains real-time counters if PostgreSQL is offline.

#### FR-ANA-02: Analytics Query API

- **`GET /analytics/summary`**: Requires `shouldBeAdmin`. Returns live platform KPIs (`totalRevenue`, `totalOrders`, `totalSignups`, `totalProductsCreated`).
- **`GET /analytics/daily-chart`**: Requires `shouldBeAdmin`. Returns daily series (`total_revenue`, `total_orders`).
- **`GET /analytics/events`**: Requires `shouldBeAdmin`. Returns recent event audit log stream.
