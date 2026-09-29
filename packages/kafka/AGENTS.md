# AGENTS.md — packages/kafka

Scope: `packages/kafka` only. Root rules still apply — start there.

## What this package is

The single place `kafkajs` is used. It exposes `createKafkaClient`,
`createProducer`, and `createConsumer` helpers and the local Kafka compose file.

Consumers: all backend services. Do not import app code into this package.

## Public API

- `createKafkaClient(serviceName)` — creates a KafkaJS client with `clientId` set and the
  three local broker addresses.
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

## Error handling

- The consumer wrapper catches per-message errors and logs them so one bad message does not
  kill the consumer loop.
- There is no dead-letter topic or retry policy yet; treat handler failures as observable,
  not fatal.

## What not to do

- Do not instantiate `kafkajs` directly in apps. Use the package helpers.
- Do not add app-specific logic into this package.
- Do not export raw KafkaJS internals unnecessarily.
- Do not remove or rename public helpers without checking every consumer.

## Verification

- `pnpm --filter @repo/kafka check-types`
- Start local Kafka and run a producer/consumer against it; inspect topics in Kafka UI
  at `:8080`.
- No general JavaScript test runner exists yet; verify the wrapper with type-checking and a local Kafka producer/consumer flow.
