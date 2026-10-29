# `@repo/kafka`

KafkaJS client wrapper, Dead-Letter Queue (DLQ) poison-pill isolation, exponential retry backoff, and local Docker Compose infrastructure for Larekmart.

---

## Public API

- `createKafkaClient(serviceName, brokers?)`: Creates a KafkaJS instance configured with custom brokers or default `:9094`, `:9095`, `:9096`.
- `createProducer(client)`: Helper wrapping producer connection and publishing with `{ value: payload }` envelope.
- `createConsumer(client, config)`: Helper wrapping consumer coordination, partition subscriptions, poison-pill DLQ routing, and exponential retry backoff.
- `classifyError(err)`: Classifies errors into poison-pills (`SyntaxError`, `ZodError`) or transient errors.

---

## Dead-Letter Queue (DLQ) & Poison-Pill Isolation

- **Poison-Pill Fast-Fail**: Non-transient errors (such as `SyntaxError` on malformed JSON or `ZodError` schema validation failures) bypass retries and route directly to `<topic>.dlq` on attempt 1.
- **Exponential Backoff**: Transient handler errors retry up to `maxRetries` (default 3) with exponential backoff (1s, 2s, 4s).
- **Terminal DLQ Routing**: If retries are exhausted, the message is dispatched to `<topic>.dlq` with failure metadata headers (`x-original-topic`, `x-original-partition`, `x-original-offset`, `x-consumer-group`, `x-error-message`, `x-attempt-count`, `x-is-poison-pill`, `x-failed-at`), and the partition offset is committed so partition consumption is not blocked.

---

## Local Cluster

Start the 3-broker cluster with Kafka UI:

```bash
docker compose -f packages/kafka/docker-compose.yml up -d
```

- **Brokers**: `localhost:9094`, `localhost:9095`, `localhost:9096`
- **ZooKeeper**: `localhost:2181`
- **Kafka UI**: `http://localhost:8080`

---

## Verification & Testing

```bash
# Offline unit tests (DLQ routing, poison-pill fast-fail, exponential backoff)
pnpm --filter @repo/kafka test

# Type check
pnpm --filter @repo/kafka check-types
```
