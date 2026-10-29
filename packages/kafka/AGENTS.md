# AGENTS.md — packages/kafka

Scope: `packages/kafka` only. Root rules still apply — start there.

## What this package is

The single place `kafkajs` is used. It exposes `createKafkaClient`,
`createProducer`, and `createConsumer` helpers and the local Kafka compose file.

Consumers: all backend services. Do not import app code into this package.

## Public API

- `createKafkaClient(serviceName, brokers?)` — creates a KafkaJS client with `clientId` set and
  explicit broker addresses (or falls back to environment / default local brokers).
- `createProducer(client)` — wraps `kafkajs` producer usage.
- `createConsumer(client, config)` — wraps consumer setup.

Current helper surface is intentionally small. Expose helpers, not raw clients.

## Kafka conventions

- Topic naming: `<entity>.<past-tense-event>` — `product.created`, `payment.successful`.
- Producer envelope: `{ value: payload }`.
- Consumers receive the parsed message and read `message.value`.
- Subscriptions: `[{ topicName, topicHandler }]`. A topic appears once per consumer.
- Consumer groups: one per service, named `<service>-group` or the service name for
  `email-service`.
- `fromBeginning: true` is the current delivery behavior. New consumer groups replay topic
  history; keep handlers defensive and idempotent-friendly.

## Local infrastructure

- `packages/kafka/docker-compose.yml` runs 3 brokers (`confluentinc/cp-kafka:7.5.0`) on
  `localhost:9094`, `:9095`, `:9096`, plus ZooKeeper `:2181` and Kafka UI `:8080`.
- Start it with `docker compose -f packages/kafka/docker-compose.yml up -d`.
- Broker ports are bound to `127.0.0.1` only: a PLAINTEXT broker reachable from the
  network lets any peer impersonate any service on the event bus. Do not re-publish
  these ports on `0.0.0.0`; SASL/SCRAM + ACLs are required before any shared exposure.
- Broker addresses resolve from the `KAFKA_BROKERS` env var (comma-separated) when
  set, falling back to the three local development brokers. media-service uses this
  for its containerized single-broker setup. Note the local brokers are still bound
  to `127.0.0.1` only: do not re-publish them on `0.0.0.0` without SASL/SCRAM + ACLs.

## Error handling & Dead-Letter Queue (DLQ)

- `createConsumer` implements automated retry and Dead-Letter Queue routing by default (`ConsumerRetryOptions`):
  - **Poison-Pill Fast-Fail**: Non-transient errors (such as `SyntaxError` on malformed JSON or `ZodError` schema validation failures) bypass retries and route directly to `<topic>.dlq` on attempt 1.
  - **Exponential Backoff**: Transient handler errors retry up to `maxRetries` (default 3) with exponential backoff (default 1s, 2s, 4s).
  - **Terminal DLQ Routing**: If retries are exhausted, the message is dispatched to `<topic>.dlq` with failure metadata headers (`x-original-topic`, `x-original-partition`, `x-original-offset`, `x-consumer-group`, `x-error-message`, `x-attempt-count`, `x-is-poison-pill`, `x-failed-at`), and the partition offset is committed so partition consumption is not blocked.
  - An embedded lazy producer is managed automatically per consumer instance and cleanly disconnected on shutdown.

## What not to do

- Do not instantiate `kafkajs` directly in apps. Use the package helpers.
- Do not add app-specific logic into this package.
- Do not export raw KafkaJS internals unnecessarily.
- Do not remove or rename public helpers without checking every consumer.

## Verification

```bash
pnpm --filter @repo/kafka test          # Unit tests (DLQ routing, poison pills, retry backoff)
pnpm --filter @repo/kafka check-types   # Type check
```
