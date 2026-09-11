# `@repo/kafka`

KafkaJS client wrapper and local Docker Compose infrastructure for Larekmart.

## Public API

- `createKafkaClient(serviceName)`: Creates a KafkaJS instance configured with brokers `:9094`, `:9095`, `:9096`.
- `createProducer(client)`: Helper wrapping producer connection and publishing.
- `createConsumer(client, groupId)`: Helper wrapping consumer coordination and subscriptions.

## Local Cluster

Start the 3-broker cluster with Kafka UI:

```bash
docker compose -f packages/kafka/docker-compose.yml up -d
```

- **Brokers**: `localhost:9094`, `localhost:9095`, `localhost:9096`
- **ZooKeeper**: `localhost:2181`
- **Kafka UI**: `http://localhost:8080`

## Development Commands

```bash
pnpm --filter @repo/kafka check-types
```
