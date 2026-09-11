# ADR 0002: Polyglot Persistence (PostgreSQL for Catalog, MongoDB for Orders)

## Status

Accepted

## Context

The product catalog requires relational modeling, foreign key constraints (categories, variants), and structured querying. The order management system requires flexible schema documents with nested line items, status tracking, and time-series analytics aggregations.

## Decision

Adopt a database-per-service polyglot architecture:

- `product-service` owns PostgreSQL persistence via Prisma (`@repo/product-db`).
- `order-service` owns MongoDB persistence via Mongoose (`@repo/order-db`).
- Shared domain types are exposed via `@repo/types` to ensure type consistency without sharing runtime database connections.

## Consequences

### Positive

- Optimal database engine selection tailored to domain requirements.
- Strong boundaries: no service can access or mutate another service's database directly.

### Negative

- Local development requires running both PostgreSQL and MongoDB instances.
- Cross-domain reporting requires analytical Kafka pipelines rather than database joins.
