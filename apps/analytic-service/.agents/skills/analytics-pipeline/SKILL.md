---
name: analytics-pipeline
description: Use when modifying Kafka event stream listeners, consumer subscriptions, or resilient background processing in apps/analytic-service.
---

# Analytics Pipeline Workflows

Guidance for developing the event consumption and pipeline logic in `apps/analytic-service`.

## 1. Pipeline Architecture

- `analytic-service` is a high-throughput **Go 1.22** microservice and multithreaded Kafka consumer running on port `8004`.
- Decoupled ingestion loop: Dedicated reader goroutines consume from Apache Kafka via `segmentio/kafka-go` using consumer group `analytic-service-group` (`internal/ingestion/consumer.go`).
- Messages are pushed directly into a bounded in-memory channel queue buffer (10,000 capacity) (`internal/ingestion/batcher.go`).
- Worker goroutines drain the channel buffer and persist events in micro-batches (up to 1,000 events or 500ms timeout) using PostgreSQL binary `pgx.CopyFrom`.
- Dedicated Kafka heartbeat loops run uninterrupted in their own goroutines, preventing `session.timeout.ms` expirations and consumer group rebalances during heavy traffic spikes.

## 2. Event Subscriptions (60+ Topics)

The analytics pipeline listens to event streams across all 23 microservices:

- **Orders & Payments**: `order.created`, `order.paid`, `order.confirmed`, `order.cancelled`, `payment.successful`, `payment.failed`, `payment.refund.succeeded`.
- **Shipments & Logistics**: `shipment.created`, `shipment.dispatched`, `shipment.delivered`, `shipment.failed`.
- **Returns & Exchanges**: `return.requested`, `return.approved`, `return.rejected`, `return.inspected`, `return.completed`.
- **Promotions & Taxes**: `promotion.redeemed`, `tax.calculated`.
- **Merchants & Stores**: `vendor.registered`, `vendor.verified`, `vendor.rejected`, `vendor.escrow.locked`, `vendor.escrow.released`, `vendor.payout.requested`, `vendor.payout.completed`, `seller.created`, `seller.activated`, `seller.suspended`, `seller.storefront.updated`.
- **Disputes**: `dispute.created`, `dispute.rebutted`, `dispute.resolved`.
- **Inventory & Catalog**: `product.created`, `product.updated`, `product.deleted`, `stock.reserved`, `stock.released`.
- **Users & Carts**: `user.created`, `cart.created`, `cart.item_added`, `cart.item_removed`, `cart.merged`.

## 3. Resilience & Failure Handling

- Extract event payloads supporting both `{ value: payload }` envelope and raw byte JSON formats.
- Lock-free atomic counters (`internal/metrics/store.go`) record in-memory KPI snapshots continuously, even if PostgreSQL or Redis are temporarily unreachable.
- Graceful shutdown handles `SIGINT`/`SIGTERM`, flushing pending in-flight batches before closing Kafka readers and database pools.

## 4. Verification

```bash
# Run unit & concurrency tests
pnpm --filter analytic-service test
# or: go test -v ./...

# Run static type and vetting checks
pnpm --filter analytic-service check-types
# or: go vet ./cmd/... ./internal/...
```
