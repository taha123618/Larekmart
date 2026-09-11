# AGENTS.md — packages/monitoring

Scope: `packages/monitoring` only. Root rules still apply — start there.

## What this package is

The centralized monitoring, logging, health check, performance timing, and observability package for the Larekmart monorepo.

It is a framework-agnostic internal library designed to be imported by any backend service (`product-service`, `order-service`, `payment-service`, `auth-service`, `email-service`, `analytic-service`), frontend (`client`, `admin`), or package (`@repo/kafka`).

## Public API & Exports

Exports are defined through the `exports` map in `packages/monitoring/package.json`:

- `createLogger`, `Logger`
- `createHealthRegistry`, `HealthRegistry`, `createMemoryCheck`, `createDbCheck`, `createHttpPingCheck`
- `createMetricsRegistry`, `MetricsRegistry`
- `measureAsync`, `measureSync`, `startTimer`
- `AppError`, `formatError`, `captureError`, `isOperationalError`
- `createHttpMonitor`, `createKafkaMonitor`, `createDatabaseMonitor`
- Full type definitions (`LogLevel`, `ServiceHealthReport`, `MetricsSnapshot`, etc.)

## What belongs here

- Framework-agnostic logging, metrics, error handling, and health inspection logic.
- Helpers to measure async/sync function execution and format machine-readable logs.
- Metric types, labels, and statistical distribution calculators.

## What does not belong here

- Framework-specific hard dependencies (do NOT add express, fastify, hono, next, prisma, or mongoose as hard runtime dependencies).
- Application-specific business rules or schema validation (use `@repo/types`).
- Service-specific database connections or Kafka producer clients.

## Development & Modification Rules

- **Zero Framework Coupling**: Keep all hooks and classes framework-agnostic so any runtime can consume them without dragging unnecessary dependencies into client bundles.
- **Strict TypeScript**: Preserve strict null checks, no `any`, and explicit return types.
- **Safe Serialization**: Ensure logger methods never throw errors when handling circular structures, BigInt values, or custom Error objects.

## Verification

- `pnpm --filter @repo/monitoring check-types`
- `pnpm check-types` (monorepo wide)
