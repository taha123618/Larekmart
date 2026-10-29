# Architectural Specification: Chaos Engineering & Adaptive Rate Limiting Guardrails

## 1. Context & Motivation

Larekmart's distributed checkout Saga coordinates state consistency across three distinct database engines:
- **MongoDB**: Orders & fulfillment state machine (`apps/order-service`)
- **PostgreSQL**: Warehouse inventory ledger & reservations (`apps/inventory-service`)
- **MySQL**: Multi-jurisdiction tax calculation & auditable quotes (`apps/tax-service`)

Under flash-sale conditions or sudden traffic surges, partial infrastructure failures (e.g. transient network latency on MySQL, broker disconnection in Kafka, or MongoDB network partitions) could threaten to leave transactions trapped in `pending_confirmation` states, causing inventory leakage or stuck customer payments.

To guarantee that automated compensations and rollbacks execute without human intervention or data drift, Larekmart deploys:
1. Declarative **Chaos Mesh** custom resource definitions (CRDs) inside `infrastructure/chaos/` to simulate active failure conditions.
2. **Adaptive Rate Limiting & In-Flight Concurrency Bulkheads** at the API Gateway (`apps/api-gateway`) to dynamically shed excess load when downstream transactional microservices report degraded health.
3. **Automated CI Chaos Resilience Verification** in `apps/order-service` and `apps/api-gateway` to validate clean compensation rollbacks under active failure injection.

---

## 2. Declarative Chaos Engineering Framework (`infrastructure/chaos/`)

The failure injection suite utilizes CNCF **Chaos Mesh** CRDs configured for the `larekmart` Kubernetes namespace:

| Manifest | Kind | Injected Failure | Target Component | Resilience Guarantee Tested |
| :--- | :--- | :--- | :--- | :--- |
| `tax-mysql-latency.yaml` | `NetworkChaos` | `3500ms ± 500ms` delay on port 3306 | `tax-service` → MySQL | Dual-ACK timeout sweeper activates and safely triggers `inventory.reservation.cancelled` and `payment.refund.requested`. |
| `order-mongo-partition.yaml` | `NetworkChaos` | 100% packet drop (bidirectional) | `order-service` ↔ MongoDB | Transactional outbox durable queueing; retry backoff prevents message loss during DB network cuts. |
| `kafka-broker-kill.yaml` | `PodChaos` | Random pod termination (`fixed: 1`) | `kafka-cluster` pods | Outbox relay publisher gracefully handles disconnections, queues events in MongoDB, and delivers upon broker reconnect. |
| `inventory-pg-loss.yaml` | `NetworkChaos` | 30% packet corruption & 200ms latency | `inventory-service` → PostgreSQL | Redis stock gatekeeper fast-fail prevents PostgreSQL connection pool saturation. |
| `flash-sale-chaos-workflow.yaml` | `Workflow` | Serial orchestration pipeline | Multi-tier components | End-to-end flash-sale resilience under sequential failure conditions. |

---

## 3. API Gateway Adaptive Guardrails (`apps/api-gateway`)

### 3.1 In-Flight Concurrency Bulkheads (`InFlightBulkhead`)

To prevent thread and socket starvation at the gateway layer when downstream databases experience latency spikes:
- The gateway tracks active in-flight concurrent requests on `/checkout` and `/payments`.
- **Healthy Capacity**: Allows up to 50 concurrent requests.
- **Degraded Capacity**: When any downstream transactional dependency (`order-service`, `tax-service`, `inventory-service`, `payment-service`) trips its circuit breaker to `OPEN` or `HALF_OPEN`, concurrency is dynamically clamped to **5**.
- Excess requests are immediately shed with **HTTP 503 Service Unavailable** and `Retry-After: 15`.

### 3.2 Dynamic Policy Clamping (`getAdaptiveRateLimitForRoute`)

- Normal sliding-window rate limit for `/checkout`: **30 requests / minute**.
- Degraded sliding-window rate limit under active chaos: **5 requests / minute**.
- Non-transactional routes (such as `/catalog`, `/search`) remain unthrottled, isolating critical failure blast radius.

---

## 4. Multi-DB Saga Chaos Rollback Invariants (`apps/order-service`)

Under simulated failure injection, the checkout Saga orchestrator enforces:
1. **Zero Orphan State**: All orders stuck past the Dual-ACK timeout window (60s) transition to `cancelled_out_of_stock` or `cancelled_tax_mismatch`.
2. **Automated Stock Unblocking**: Emits `inventory.reservation.cancelled` to restore reserved quantities to available stock.
3. **Automated Customer Refund**: Emits `payment.refund.requested` to trigger Stripe payment intent refunds.
4. **Outbox Durability**: Events that fail to publish during Kafka downtime are stored in MongoDB with exponential backoff and delivered once connectivity is restored.
5. **Cluster Lease Isolation**: Competing pods skip timeout sweep iterations while another pod holds the `order:saga:timeout:sweeper:leader` lease.

---

## 5. Verification & Acceptance Criteria

- [x] All 5 Chaos Mesh CRD manifests validate via `kubectl kustomize infrastructure/chaos/`.
- [x] API Gateway Chaos Guardrails unit and integration tests pass 100% (`apps/api-gateway/tests/resilience/chaos-guardrails.test.ts`).
- [x] Order Service Multi-DB Saga Chaos Resilience suite passes 100% (`apps/order-service/tests/chaos-saga-resilience.test.ts`).
- [x] Full monorepo TypeScript compilation passes with zero type errors (`pnpm check-types`).

