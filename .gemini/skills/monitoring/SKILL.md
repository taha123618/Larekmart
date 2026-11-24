---
name: monitoring
description: Global guide for telemetry, structured logging, health checks, and metrics across Larekmart services using @repo/monitoring.
---

# Global Monitoring & Observability Skill

Use this skill when implementing, debugging, or reviewing monitoring, health checks, structured logging, error tracking, or performance metrics in any Larekmart service or frontend.

## 1. Centralized Observability Policy

Larekmart standardizes all observability across its microservices, frontends, and shared packages through `@repo/monitoring`.

- **Structured Logging**: Always use `createLogger(serviceName)` instead of bare `console.log` for service backends. Calling `createLogger` automatically initializes the OpenTelemetry `Tracer` with the service identity.
- **Distributed Tracing (OpenTelemetry)**: Traces are automatically streamed to Tempo (`http://localhost:4318/v1/traces`). W3C `traceparent` headers are propagated across HTTP and Kafka boundaries.
- **Adaptive Sampling**: Captures 100% of traces encountering HTTP 5xx errors, saga compensations, exceptions, or Kafka DLQ poison pills; applies 5% probabilistic sampling to high-frequency read traffic in production.
- **Transactional Outbox Continuity**: In transactional outbox services (`order-service`), persist transport headers (`headers: { traceparent, x-correlation-id }`) in MongoDB `OutboxEvent` documents so asynchronous sweepers preserve root trace lineage into Kafka.
- **Health Checks**: Every backend service must expose `GET /health` powered by `createHealthRegistry(serviceName)`.
- **Metrics**: Track request throughput, database latency, and Kafka event delivery using `MetricsRegistry`.
- **Error Normalization**: Use `AppError` for operational/business validation errors and `captureError` to record unexpected failures.

## 2. Best Practices

1. **Child Logger Scoping**: When handling incoming HTTP requests or Kafka events, create a child logger with `requestId`, `userId`, or `correlationId`.
2. **Non-blocking Health Checks**: Health checks must never cause service hangs; configure appropriate timeouts (e.g. 3000ms–5000ms).
3. **Labels Discipline**: Do not use high-cardinality values (e.g. raw UUIDs, email addresses) as metric label keys; use route patterns (`/products/:id`) and status classes (`2xx`, `4xx`, `5xx`).
