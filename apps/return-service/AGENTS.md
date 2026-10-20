# AGENTS.md — return-service

## 1. What this is

`return-service` is the **complete product-return and refund-coordination microservice** for Larekmart. It runs as a standalone Koa 2 service on **port 8018** with a dedicated **MySQL (`return_db`)** database via Drizzle ORM.

It owns the entire return lifecycle — from eligibility checks and return-request submission through shipment tracking, warehouse inspection, and asynchronous Stripe refund SAGA coordination — without executing payments or managing inventory/shipping directly.

Read `docs/ARCHITECTURE.md` for the full system picture and `docs/EVENT-DRIVEN-ARCHITECTURE.md` for event contracts.

## 2. Architecture & Responsibilities

```
Client / Admin  ──► API Gateway (x-user-id, x-user-role)
                         │
                         ▼
                   return-service :8018 (Koa 2)
                         │
              ┌──────────┼──────────────────────┐
              │          │                      │
           MySQL       Redis               Kafka topics
         (return_db)  (cache)       (outbox worker → broker)
              │                              │
     Drizzle ORM                  Consumes: order.delivered
                                             payment.refund.succeeded/failed
                                             shipping.label.created
                                  Publishes: return.requested
                                             return.approved
                                             return.rejected
                                             return.cancelled
                                             return.shipment.requested
                                             return.inspection.completed
                                             return.refund.requested
                                             return.completed
```

**This service does NOT:**
- Execute Stripe refund API calls (that is `payment-service`'s job)
- Create shipping labels or call carriers (that is `shipping-service`'s job)
- Modify stock levels directly (that is `inventory-service`'s job via Kafka events)

## 3. Database Schema

All tables are in the `return_db` MySQL database. Migrations are managed via **Drizzle Kit**:

```bash
pnpm --filter return-service db:generate    # generate SQL migration files
pnpm --filter return-service db:migrate     # apply migrations
pnpm --filter return-service db:seed        # seed policy versions & reasons
```

Key tables:
- `return_policy_versions` — versioned return windows & restocking fees
- `return_reasons` — enumerated reason codes and manual-review flags
- `returns` — main return header with status, refund amounts, and audit trail
- `return_items` — per-item return details (qty, proration, disposition)
- `return_evidence` — media-service asset references
- `return_shipments` — carrier/tracking for both buyer-paid and prepaid labels
- `return_inspections` — warehouse inspection outcomes
- `return_refund_requests` — Stripe refund coordination records
- `return_outbox` — transactional outbox for reliable Kafka publishing
- `return_status_history` — immutable state-transition audit log

## 4. State Machine

```
REQUESTED ──► PENDING_REVIEW ──► APPROVED ──► AWAITING_RETURN_SHIPMENT
    │               │                │                 │
    │               ▼                │                 ▼
    │           REJECTED         CANCELLED         IN_TRANSIT
    │                                                   │
    │                                                   ▼
    │                                               RECEIVED
    │                                                   │
    │                                                   ▼
    │                                             INSPECTION
    │                                            /           \
    │                                      DISPUTED      REFUND_PENDING
    │                                            \           /
    │                                          REFUND_FAILED
    │                                                │
    └───────────────────────────────────────► COMPLETED
```

Import `ReturnStateMachine.assertTransition()` before every status change. Terminal states are `COMPLETED`, `REJECTED`, and `CANCELLED` — no further transitions allowed.

## 5. Key Conventions

### Authentication
- Customer routes use `shouldBeUser` middleware (derives identity from `x-user-id` gateway header or Bearer JWT)
- Admin routes use `shouldBeAdmin` middleware (requires `x-user-role: admin` or internal gateway secret)
- `userId` is **always** derived from verified headers — never trust `ctx.request.body`

### Transactional Outbox Pattern
All Kafka event publishing goes through the `return_outbox` table (written in the same DB transaction as the state change). The `outbox.worker.ts` polls for `PENDING` rows and publishes them to Kafka, then marks them `PUBLISHED` or `FAILED`. **Never call `producer.send()` directly from service or controller code.**

### Proration Logic
`proration.service.ts` handles all refund arithmetic using `decimal.js` to avoid floating-point errors. Quantities, discounts, and taxes are all prorated proportionally to the returned quantity. The total always floors to `0.00` (never negative).

### Error Handling
- All endpoints return `{ message: string }` JSON with appropriate HTTP status codes
- Async Kafka consumer handlers catch and log errors per-message — a bad message never crashes the consumer loop
- State transitions that violate the state machine throw `Error` — let the error middleware convert to 409

## 6. Kafka Events

### Consumed (from other services)
| Topic | Source | Handler |
|-------|--------|---------|
| `order.delivered` | `order-service` | Marks order as returnable (observability only) |
| `payment.refund.succeeded` | `payment-service` | Transitions return to `COMPLETED`, publishes `return.completed` |
| `payment.refund.failed` | `payment-service` | Transitions return to `REFUND_FAILED` |
| `shipping.label.created` | `shipping-service` | Records prepaid label, transitions to `AWAITING_RETURN_SHIPMENT` |

### Published (to other services)
| Topic | Trigger | Consumers |
|-------|---------|-----------|
| `return.requested` | New return submitted | `analytic-service`, `notification-service` |
| `return.approved` | Admin/auto-approves | `notification-service`, `shipping-service` |
| `return.rejected` | Admin rejects | `notification-service` |
| `return.cancelled` | Customer cancels | `analytic-service`, `notification-service` |
| `return.shipment.requested` | Approval with prepaid label | `shipping-service` |
| `return.inspection.completed` | Warehouse records inspection | `inventory-service`, `analytic-service` |
| `return.refund.requested` | Inspection passes | `payment-service` |
| `return.completed` | Refund confirmed | `notification-service`, `analytic-service`, `order-service` |

## 7. API Gateway Routes

| External Path | Internal Path | Auth |
|---------------|---------------|------|
| `POST /api/v1/returns/orders/:orderId` | `POST /api/returns/orders/:orderId` | User |
| `GET /api/v1/returns` | `GET /api/returns` | User |
| `GET /api/v1/returns/:returnId` | `GET /api/returns/:returnId` | User |
| `DELETE /api/v1/returns/:returnId` | `DELETE /api/returns/:returnId` | User |
| `POST /api/v1/returns/:returnId/evidence` | `POST /api/returns/:returnId/evidence` | User |
| `POST /api/v1/returns/:returnId/tracking` | `POST /api/returns/:returnId/tracking` | User |
| `GET /api/v1/admin/returns` | `GET /api/admin/returns` | Admin |
| `GET /api/v1/admin/returns/:returnId` | `GET /api/admin/returns/:returnId` | Admin |
| `POST /api/v1/admin/returns/:returnId/approve` | `POST /api/admin/returns/:returnId/approve` | Admin |
| `POST /api/v1/admin/returns/:returnId/reject` | `POST /api/admin/returns/:returnId/reject` | Admin |
| `POST /api/v1/admin/returns/:returnId/inspect` | `POST /api/admin/returns/:returnId/inspect` | Admin |
| `POST /api/v1/admin/returns/:returnId/refund/retry` | `POST /api/admin/returns/:returnId/refund/retry` | Admin |

## 8. Commands

```bash
pnpm --filter return-service dev            # development server (tsx --watch)
pnpm --filter return-service check-types   # TypeScript strict check
pnpm --filter return-service test          # unit tests (proration, state machine, schemas)
pnpm --filter return-service db:generate   # generate Drizzle migration SQL
pnpm --filter return-service db:migrate    # apply migrations to return_db
pnpm --filter return-service db:seed       # seed policy versions & return reasons
```

## 9. Environment Variables

See `.env.example` for the full list. Required in production:
- `DATABASE_URL` or `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE`
- `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_GROUP_ID`
- `REDIS_URL`
- `GATEWAY_INTERNAL_SECRET` (must differ from default in production)

## 10. Definition of Done

Before completing a task in this workspace:
- [ ] `pnpm --filter return-service check-types` passes (0 errors)
- [ ] `pnpm --filter return-service test` passes
- [ ] State machine transitions are enforced (use `ReturnStateMachine.assertTransition`)
- [ ] All Kafka events go through the outbox (no direct `producer.send()` in services)
- [ ] New env vars added to `.env.example` (never a real `.env`)
- [ ] `AGENTS.md` and `docs/EVENT-DRIVEN-ARCHITECTURE.md` updated if contracts changed
