---
name: kafka-event-system
description: Use when modifying the Kafka client wrapper, producer/consumer abstractions, event envelopes, or local compose configuration in packages/kafka.
---

# Kafka Event System Architecture

Guidance for maintaining `@repo/kafka` and cross-service messaging in Larekmart.

## 1. Abstractions & Helpers

- `createKafkaClient(serviceName)`: Instantiates a `kafkajs` client with configured client ID and broker endpoints.
- `createProducer(client)`: Wraps producer lifecycle (`connect()`, `send()`, `disconnect()`).
- `createConsumer(client, groupId)`: Manages group coordination and topic subscriptions.

## 2. Event Envelope & Payload Conventions

- **Producer Envelope**: Always wrap payload in an object containing `value`:
  ```ts
  await producer.send("order.created", {
    value: { email, amount, status },
  });
  ```
- **Consumer Deserialization**: Handlers receive the deserialized message and access `message.value`.
- **Error Isolation**: The consumer loop wraps individual handler invocations in `try/catch` to ensure one malformed message does not crash the consumer.

## 3. Idempotency & Replayability

- Subscriptions use `fromBeginning: true`. Handlers must be idempotent to handle re-deliveries safely.

## 4. Topic Contract Management

When adding or updating topics:

1. Update types in `packages/types/src/index.ts`.
2. Update producer and consumer implementations.
3. Document payload in `docs/EVENT-DRIVEN-ARCHITECTURE.md`.

## 5. Verification

```bash
pnpm --filter @repo/kafka check-types
# Verify local cluster status
docker compose -f packages/kafka/docker-compose.yml ps
```
