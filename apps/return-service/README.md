# @repo/return-service

Production-grade, multi-seller marketplace Return & Refund Orchestration Microservice for the Larekmart platform. Manages customer return requests, partial-quantity item proration, evidence media, warehouse inspections, return shipments, refund SAGA coordination, and transactional outbox event publishing without violating service boundaries.

## Architecture & Technology Stack

- **Runtime**: Node.js 22 LTS
- **Framework**: Koa 2 (`@koa/router`, `@koa/cors`, `koa-bodyparser`)
- **Database**: MySQL 8.0 (`return_db`) with Drizzle ORM
- **Cache & Limits**: Redis (`@repo/redis`) with namespace `return:v1:*`
- **Event Bus**: Apache Kafka (`@repo/kafka`) with transactional outbox pattern
- **Precision Arithmetic**: `decimal.js` with `ROUND_HALF_UP` bankers rounding
- **Validation**: Zod contract schemas from `@repo/types`
- **Telemetry**: `@repo/monitoring` Prometheus metrics (`/metrics`) and structured logging
- **Default Port**: `8018`

## Core Capabilities

1. **Finite State Machine Lifecycle**:
   - Manages return progression across 13 formal states:
     `REQUESTED` → `PENDING_REVIEW` → `APPROVED` → `AWAITING_RETURN_SHIPMENT` → `IN_TRANSIT` → `RECEIVED` → `INSPECTION` → `REFUND_PENDING` → `COMPLETED`.
   - Explicit terminal states: `REJECTED`, `CANCELLED`, `REFUND_FAILED`.
   - Immutable audit logging of all state transitions with actor identification (`return_state_transitions`).

2. **Strict Return Eligibility Engine**:
   - Enforces configurable return window policies (default 14 days post-delivery).
   - Validates purchase state against delivered order items.
   - Restricts ineligible or final-sale categories.

3. **High-Precision Decimal Proration**:
   - Proportions bundle discounts and sales tax across returned units (`ProrationService`).
   - Deducts return-shipping fees when applicable (e.g. buyer's remorse).
   - Prevents negative refund totals with zero-floor protection.

4. **Evidence & Inspection Workflow**:
   - Allows customers and warehouse staff to attach photos/videos as evidence (`return_media`).
   - Supports multi-item warehouse dispositions: `RESTOCK_SELLABLE`, `RESTOCK_REFURBISHED`, `DAMAGED_SCRAP`, `RETURN_TO_VENDOR` (`return_inspections`).

5. **Refund SAGA & Transactional Outbox**:
   - Coordinates with `payment-service` to initiate idempotent Stripe refunds (`return_refunds`).
   - Outbox table (`return_outbox`) and worker loop publish Kafka events with at-least-once reliability.

## REST API Reference

All requests route through `api-gateway` on port `8080`.

### Customer Endpoints (`/api/v1/returns`)

| Method   | Route                                | Description                                   | Auth Required  |
| -------- | ------------------------------------ | --------------------------------------------- | -------------- |
| `POST`   | `/api/v1/returns/orders/:orderId`    | Submit a return request for a delivered order | Yes (Customer) |
| `GET`    | `/api/v1/returns`                    | List caller's return requests                 | Yes (Customer) |
| `GET`    | `/api/v1/returns/:returnId`          | Get return details (ownership verified)       | Yes (Customer) |
| `DELETE` | `/api/v1/returns/:returnId`          | Cancel a return (while in `REQUESTED` status) | Yes (Customer) |
| `POST`   | `/api/v1/returns/:returnId/evidence` | Attach media evidence                         | Yes (Customer) |
| `POST`   | `/api/v1/returns/:returnId/tracking` | Submit return-shipment tracking info          | Yes (Customer) |

### Admin Endpoints (`/api/v1/admin/returns`)

| Method | Route                                          | Description                                    | Auth Required |
| ------ | ---------------------------------------------- | ---------------------------------------------- | ------------- |
| `GET`  | `/api/v1/admin/returns`                        | List returns with filtering (status, sellerId) | Yes (Admin)   |
| `GET`  | `/api/v1/admin/returns/:returnId`              | Detailed return review                         | Yes (Admin)   |
| `POST` | `/api/v1/admin/returns/:returnId/approve`      | Approve return and issue prepaid label         | Yes (Admin)   |
| `POST` | `/api/v1/admin/returns/:returnId/reject`       | Reject return with mandatory reason            | Yes (Admin)   |
| `POST` | `/api/v1/admin/returns/:returnId/inspect`      | Record warehouse item inspection               | Yes (Admin)   |
| `POST` | `/api/v1/admin/returns/:returnId/refund/retry` | Retry failed refund SAGA                       | Yes (Admin)   |

### Health & Observability

| Method | Route      | Description                                          |
| ------ | ---------- | ---------------------------------------------------- |
| `GET`  | `/health`  | Liveness check verifying MySQL database connectivity |
| `GET`  | `/ready`   | Readiness check                                      |
| `GET`  | `/metrics` | Prometheus metrics scrape endpoint                   |

## Kafka Event Contracts

### Published Topics

- `return.requested`: Emitted when customer initiates a return request.
- `return.approved`: Emitted when an admin or policy auto-approves a return.
- `return.rejected`: Emitted when a return is rejected.
- `return.cancelled`: Emitted when a customer cancels a return.
- `return.shipment.requested`: Emitted to request return shipping label generation.
- `return.inspection.completed`: Emitted after warehouse inspection.
- `return.refund.requested`: Emitted to trigger Stripe refund in `payment-service`.
- `return.completed`: Emitted when full refund is confirmed and return lifecycle finishes.

### Consumed Topics

- `order.delivered`: Unlocks return window eligibility.
- `payment.refund.succeeded`: Marks refund completed and transitions return to `COMPLETED`.
- `payment.refund.failed`: Marks refund as failed and flags for admin retry.
- `shipping.label.created`: Attaches carrier tracking number and label URL.

## Development & Testing

```bash
# Start return-service in development mode (hot reloading)
pnpm --filter return-service dev

# Type check
pnpm --filter return-service check-types

# Run test suite (Proration, State Machine, Schemas, Health)
pnpm --filter return-service test

# Run database migrations (creates return_db schema)
pnpm --filter return-service db:migrate

# Seed return policies and reasons
pnpm --filter return-service db:seed
```
