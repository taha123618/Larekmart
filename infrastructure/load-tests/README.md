# Larekmart Flash-Sale Load Testing & Saga Benchmark

High-throughput distributed load testing suite designed with [k6](https://k6.io/) to benchmark Larekmart's **50,000+ RPS Flash-Sale Architecture**:
- **Pricing Service**: Zero-DB cryptographic HMAC-signed price quote generation (`/api/v1/prices/quote`).
- **Inventory Service**: Atomic Redis Lua stock gatekeeper & bucket partitioning (`/api/v1/inventory/reservations`).
- **Order Service**: High-concurrency COD checkout, MongoDB write-plane scalability, and transactional outbox relay (`/api/v1/orders/cod`).
- **API Gateway**: Idempotency caching, reverse-proxy circuit breaking, and sub-millisecond route dispatch.

---

## Architecture Tested

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Simulated Buyer (k6 VU)
    participant Gateway as API Gateway (:8090)
    participant Pricing as Pricing Service (:8019)
    participant Inventory as Inventory Service (:8007)
    participant Redis as Redis Gatekeeper (:6379)
    participant Order as Order Service (:8001)
    participant Outbox as Transactional Outbox (Mongo)
    participant Kafka as Kafka Cluster (:9092)

    Buyer->>Gateway: POST /api/v1/prices/quote (Bearer JWT)
    Gateway->>Pricing: Forward Request
    Pricing-->>Gateway: HTTP 200 + HMAC signedQuoteToken (0 DB hops)
    Gateway-->>Buyer: Price Quote with signed cryptographic token

    Buyer->>Gateway: POST /api/v1/inventory/reservations (Qty: 1)
    Gateway->>Inventory: Forward Request
    Inventory->>Redis: Atomic Lua Precheck (claim decrement)
    alt Stock Available (> 0)
        Redis-->>Inventory: Granted (claimToken, remainingStock)
        Inventory-->>Gateway: HTTP 202 Accepted (queued to Kafka batch worker)
        Gateway-->>Buyer: Reservation Claim Granted
    else Stock Exhausted (== 0)
        Redis-->>Inventory: Fast Reject (<1ms, 0 Postgres hops)
        Inventory-->>Gateway: HTTP 409 Conflict
        Gateway-->>Buyer: Fast Reject (Controlled graceful rejection)
    end

    opt Stock Granted
        Buyer->>Gateway: POST /api/v1/orders/cod (signedQuoteToken, reservationId)
        Gateway->>Order: Forward Request + Idempotency Interceptor
        Order->>Order: Cryptographic Token Verification (0 DB hops)
        Order->>Outbox: Atomic Order Document + OutboxEvent write
        Order-->>Gateway: HTTP 201 Created (orderId)
        Gateway-->>Buyer: Order Created
        Outbox->>Kafka: Async Outbox Relay publishes order.confirmed
    end
```

---

## SLO Targets & Performance Thresholds

| Metric | Threshold | Architectural Mechanism |
| :--- | :--- | :--- |
| **Stock Fast-Reject Latency** | `p(99) < 10ms` | Redis Lua atomic precheck rejects depleted stock in memory without touching PostgreSQL. |
| **Pricing Quote Latency** | `p(95) < 35ms` | Server-authoritative HMAC SHA-256 quote tokens eliminate round-trips to the catalog database. |
| **Order Commit Latency** | `p(95) < 150ms` | Single-document atomic MongoDB write + local outbox write; Kafka publishing is strictly asynchronous. |
| **Oversell Violations** | **`0` (Strict)** | Distributed atomic Redis counter prevents allocating > initial stock regardless of concurrency. |
| **Duplicate Orders** | **`0` (Strict)** | Distributed Redis `x-idempotency-key` filter returns cached response upon duplicate submission. |

---

## Quick Start

### Prerequisites
Make sure Larekmart core services or the full stack is running:
```bash
docker compose up -d
```

### 1. Seed Flash-Sale Inventory
Initialize 100 units of the hot SKU across Redis gatekeeper buckets:
```bash
chmod +x infrastructure/load-tests/*.sh
./infrastructure/load-tests/seed-flash-sale.sh
```

### 2. Execute the Flash-Sale Benchmark
Run the k6 load test (automatically uses local `k6` or Docker image `grafana/k6:latest`):
```bash
./infrastructure/load-tests/run-flash-sale.sh
```

To customize parameters (target URL, stock amount, duration):
```bash
TARGET_URL="http://localhost:8090" \
ALLOCATED_STOCK=250 \
./infrastructure/load-tests/run-flash-sale.sh
```

---

## Live Monitoring During Flash Sale
Open Grafana (`http://monitoring.localhost` or `http://localhost:3001`):
1. **Inventory Dashboard**: Monitor `inventory_gatekeeper_claims_total` vs `inventory_gatekeeper_fast_rejects_total`.
2. **PgBouncer & PostgreSQL**: Observe active connection count — notice connection count remains flat even when 3,000+ concurrent requests arrive, thanks to transaction pooling and Redis fast-rejects.
3. **Kafka & Outbox Relay**: Observe outbox relay queue depth and Kafka consumer throughput on topic `order.confirmed`.
