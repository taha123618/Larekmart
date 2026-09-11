---
name: monitoring-architecture
description: Architecture, capabilities, and design principles of @repo/monitoring in Larekmart.
---

# Monitoring Architecture Skill

Use this skill when designing, reviewing, or extending monitoring, structured logging, health checks, or metric collection within `@repo/monitoring`.

## 1. Core Design Tenets

1. **Framework Agnostic**: The monitoring library must remain completely decoupled from specific web frameworks (Express, Fastify, Hono, Next.js) or database drivers (Prisma, Mongoose, pg).
2. **Environment Aware**:
   - `development`: Human-readable colored output, verbose debug logs, and fast fail feedback.
   - `production`: Machine-readable JSON logs for log ingestion systems (Datadog, CloudWatch, Loki), aggregated metrics, and silenced trace logs.
3. **Safe Serialization**: Logging must never throw unhandled runtime exceptions due to circular references, bigints, or custom error prototypes.
4. **Isolate Failures**: Health checks run with strict timeouts so hanging dependencies never freeze health probe responses.

## 2. Component Hierarchy

- **Logger (`src/logger.ts`)**: Structured, level-weighted logging with child metadata propagation (`requestId`, `userId`, `correlationId`).
- **Health Registry (`src/health.ts`)**: Asynchronous check runner aggregating multi-dependency availability into a structured `ServiceHealthReport`.
- **Metrics Registry (`src/metrics.ts`)**: In-memory metric accumulator supporting counters, gauges, and percentile-calculated histograms (p50, p90, p95, p99).
- **Performance (`src/performance.ts`)**: Instrumentation primitives (`measureAsync`, `startTimer`) with automatic slow-operation logging.
- **Error Tracking (`src/errors.ts`)**: Unified error classification (`AppError`), normalization (`formatError`), and reporting (`captureError`).
- **Hooks (`src/hooks.ts`)**: Generic wrappers for HTTP, Kafka, and Database event lifecycles.
