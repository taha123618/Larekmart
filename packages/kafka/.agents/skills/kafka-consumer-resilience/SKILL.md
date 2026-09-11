---
name: kafka-consumer-resilience
description: Use when debugging consumer crashes, partition rebalancing, error isolation, or retry handling in packages/kafka.
---

# Kafka Consumer Resilience & Error Isolation

Guidance for fault-tolerant consumer implementation in `@repo/kafka`.

## 1. Per-Message Error Isolation

- The `consumer.subscribe` wrapper executes message handlers inside a `try/catch` block.
- A failure in one message handler is logged with error details and does NOT cause the consumer loop to crash or the partition to stall.

## 2. Consumer Groups & Partition Assignment

- Consumer groups are named by service: `product-service-group`, `order-service-group`, `payment-service-group`, `email-service`.
- Multiple instances in the same group share topic partitions automatically.

## 3. Idempotency on Replays

- Because subscriptions use `fromBeginning: true`, consumers replay history upon new group creation.
- Handlers must use upserts or check existing database state to prevent duplicate operations.
