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

### 2.3 Marketplace Commission & Settlement Payout Lifecycle State Machine

```
   [Order Placed] ──▶ [commission-service (Rule Version Snapshot)] ──▶ [commission.calculated emitted]
                                                                              │
                                                                              ▼
   [Payment Confirmed] ──────────────────────────────────────────────▶ [commission.accrued emitted]
                                                                              │
                                                                              ▼
                                                                     [payout-service]
                                                              (Record Merchant Escrow Credit &
                                                               Platform Commission in Ledger)
                                                                              │
                                                                              ▼
   [Order Delivered] ────────────────────────────────────────────────▶ [Maturity Hold Timer Starts]
                                                                              │
                                                                              ▼ (Maturity Elapsed)
                                                                      [Funds Marked AVAILABLE]
                                                                              │
                                                                              ▼ (Scheduled Batch)
                                                                      [payout.scheduled emitted]
                                                                      (ACH/Stripe Transfer Initiated)
                                                                              │
                                                                              ▼ (Provider Webhook)
                                                                 [payout.completed / payout.failed]
                                                                 (Ledger Reconciled & Balance Updated)
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

---

### 3.7 Marketplace Commission Service (`apps/commission-service`)

#### FR-COM-01: Commission Plans & Rule Management

- **`GET /api/v1/admin/commissions/plans`**: Requires `shouldBeAdmin`. Lists all marketplace commission plans with attached rules and active status.
- **`POST /api/v1/admin/commissions/plans`**: Requires `shouldBeAdmin`. Validates and persists new plan with name, description, and status.
- **`PATCH /api/v1/admin/commissions/rules/:ruleId`**: Requires `shouldBeAdmin`. Modifies rule percentage, fixed fee, or min/max caps. Automatically increments `rule_version` and saves an immutable snapshot in `commission_rule_versions`.

#### FR-COM-02: Real-Time Quote & Order Calculation Engine

- **`POST /api/v1/internal/commissions/quote`**: Requires `x-internal-secret`. Accepts line items with `productId`, `sellerId`, `categoryId`, and `unitPrice`. Resolves rules by precedence (`PRODUCT` > `SELLER` > `CATEGORY` > `GLOBAL`), evaluates Decimal.js calculations, and emits `commission.calculated`.
- **`GET /api/v1/internal/commissions/orders/:orderId`**: Requires `x-internal-secret`. Fetches stored commission calculation breakdown and line items for a specific order.

#### FR-COM-03: Commission Reporting & Adjustments

- **`GET /api/v1/admin/commissions/reports`**: Requires `shouldBeAdmin`. Aggregates commission accrued, refunded, and net earnings across date ranges and seller IDs.

---

### 3.8 Seller Payout & Double-Entry Ledger Service (`apps/payout-service`)

#### FR-PAY-01: Double-Entry Balanced Ledger Management

- **`GET /api/v1/sellers/me/balance`**: Requires `shouldBeUser`. Computes live seller balance from `ledger_entries` (`SUM(credit) - SUM(debit)`) scoped to the verified caller's `sellerId`.
- **`GET /api/v1/sellers/me/statements`**: Requires `shouldBeUser`. Generates paginated ledger statements and accounting transactions.

#### FR-PAY-02: Automated Batch Scheduling & Disbursements

- **`POST /api/v1/internal/payouts/schedule`**: Requires `x-internal-secret`. Aggregates mature balances exceeding minimum payout thresholds, posts balanced journal debit entries to the escrow account, and emits `payout.scheduled`.

#### FR-PAY-03: Provider Webhook Reconciliation

- **`POST /api/v1/internal/payouts/reconcile`**: Requires `x-internal-secret`. Receives bank ACH or Stripe Connect settlement confirmations, transitions payout state from `PROCESSING` to `PAID` or `FAILED`, and emits `payout.completed` or `payout.failed`.

#### FR-PAY-04: Admin Payout Control & Retries

- **`GET /api/v1/admin/payouts`**: Requires `shouldBeAdmin`. Returns paginated list of all system payouts with status filters.
- **`POST /api/v1/admin/payouts/:payoutId/retry`**: Requires `shouldBeAdmin`. Resets failed payout to `PENDING` and re-queues disbursement.

---

### 3.9 Customer Support & SLA Resolution Service (`apps/support-service`)

#### FR-SUP-01: Ticket Lifecycle & Self-Service

- **`POST /api/v1/support/tickets`**: Requires `shouldBeUser`. Validates payload against `CreateTicketSchema`. Evaluates matching SLA policy rules to calculate `firstResponseDueAt` and `resolutionDueAt`. Publishes `support.ticket.created` Kafka event.
- **`GET /api/v1/support/tickets`**: Requires `shouldBeUser`. Returns paginated tickets matching the authenticated customer's `userId`.
- **`GET /api/v1/support/tickets/:id`**: Requires `shouldBeUser`. Verifies ticket ownership and returns full details, strictly redacting confidential internal staff notes (`isInternal: true`).
- **`PATCH /api/v1/support/tickets/:id`**: Requires `shouldBeUser`. Allows customer to update status (e.g. resolve) or priority. Publishes `support.ticket.updated` or `support.ticket.resolved`.

#### FR-SUP-02: Message Threads & Confidential Notes

- **`POST /api/v1/support/tickets/:id/messages`**: Requires `shouldBeUser`. Validates against `CreateTicketMessageSchema` (enforcing `isInternal: false` for customer submissions). Publishes `support.ticket.updated`.
- **`POST /api/v1/admin/support/tickets/:id/messages`**: Requires `shouldBeAdmin`. Allows agents to post either public replies or staff-only internal notes (`isInternal: true`).

#### FR-SUP-03: Agent Assignment & Escalation

- **`POST /api/v1/admin/support/tickets/:id/assign`**: Requires `shouldBeAdmin`. Assigns ticket to support agent, logs assignment audit record in `ticket_assignments`, and publishes `support.ticket.assigned`.
- **`POST /api/v1/admin/support/tickets/:id/escalate`**: Requires `shouldBeAdmin`. Escalates ticket priority and recomputes SLA breach deadlines.

#### FR-SUP-04: Support Operations & SLA Analytics

- **`GET /api/v1/admin/support/tickets`**: Requires `shouldBeAdmin`. Returns all tickets across all customers/sellers with SLA breach flags and agent filter.
- **`GET /api/v1/admin/support/analytics`**: Requires `shouldBeAdmin`. Aggregates ticket volume, status breakdown, SLA breach rate, and agent workload distribution.
