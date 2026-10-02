# Synthesized Decisions

## ADR-0001: Asynchronous Kafka Integration for Backend Services
- source: `docs/adr/0001-asynchronous-kafka-integration.md`
- status: locked (Accepted)
- decision: All cross-service integrations must be strictly asynchronous via Apache Kafka events utilizing the shared `@repo/kafka` client package. Services will not expose internal HTTP endpoints for consumption by other backend services.
- scope: Kafka, asynchronous integration, service communication, @repo/kafka

## ADR-0002: Polyglot Persistence (PostgreSQL for Catalog, MongoDB for Orders)
- source: `docs/adr/0002-polyglot-persistence.md`
- status: locked (Accepted)
- decision: Adopt a database-per-service polyglot architecture: PostgreSQL for catalog/inventory/user/shipping models (Prisma) and MongoDB for order/cart document models (Mongoose).
- scope: PostgreSQL, MongoDB, database-per-service, Prisma, Mongoose

## ADR-0003: Centralized Authentication and Role Management via Clerk
- source: `docs/adr/0003-clerk-authentication.md`
- status: locked (Accepted)
- decision: Delegate all identity management, authentication, and session handling to Clerk across all applications and backend services. Role-based access control (RBAC) relies on custom JWT claims (`sessionClaims.metadata.role === "admin"`).
- scope: Clerk, authentication, authorization, RBAC, JWT
