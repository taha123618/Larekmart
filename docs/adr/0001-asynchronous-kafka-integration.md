# ADR 0001: Asynchronous Kafka Integration for Backend Services

## Status

Accepted

## Context

Larekmart consists of multiple backend services (product, order, payment, auth, and email). Direct synchronous HTTP calls between services create tight temporal coupling, cascading failures, and complex distributed transaction handling.

## Decision

All cross-service integrations must be strictly asynchronous via Apache Kafka events utilizing the shared `@repo/kafka` client package. Services will not expose internal HTTP endpoints for consumption by other backend services. Frontends talk directly to services, and side-effects (e.g. Stripe sync, order creation, email dispatch) are driven by Kafka topics.

## Consequences

### Positive

- High resilience and failure isolation: if `email-service` is down, `order-service` continues processing.
- Independent service deployability and scaling.
- Clean contract registry in `docs/EVENT-DRIVEN-ARCHITECTURE.md` and `@repo/types`.

### Negative

- Eventual consistency across service boundaries.
- Consumers must be designed to be idempotent and handle message replay gracefully.
