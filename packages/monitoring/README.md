# `@repo/monitoring`

A framework-agnostic, production-grade monitoring and observability library for the **Larekmart** e-commerce microservices platform.

This package provides centralized utilities for structured logging, application health checks, in-memory metric collection, error formatting/classification, performance timing, and HTTP/Kafka/Database instrumentation hooks.

---

## 1. Features

- **Structured Logging (`Logger`)**:
  - Machine-readable JSON output for production log aggregators.
  - Human-friendly colored terminal formatting for local development.
  - Child logger context propagation (e.g. `requestId`, `userId`, `correlationId`).
  - Safe serialization handling circular references, BigInts, and Error stack traces.
- **Application Health Checks (`HealthRegistry`)**:
  - Concurrent check execution with individual timeout isolation.
  - Health status aggregation (`healthy`, `degraded`, `unhealthy`).
  - Built-in helpers for memory heap inspection, HTTP pinging, database queries, and Kafka availability.
- **Metrics Registry (`MetricsRegistry`)**:
  - Counters, Gauges, and Histograms with multidimensional labels.
  - Statistical latency calculations (p50, p90, p95, p99, min, max, avg).
  - Pre-built helpers: `recordHttpRequest`, `recordKafkaEvent`, `recordDbQuery`.
- **Performance Instrumentation (`measureAsync`, `measureSync`, `startTimer`)**:
  - Automatic timing of async/sync operations with slow-operation warnings and metric recording.
- **Error Normalization & Tracking (`AppError`, `formatError`, `captureError`)**:
  - Standardized error classification (operational vs programmer/system crashes).
  - Structured error logging and metric incrementation.
- **Monitoring Hooks (`createHttpMonitor`, `createKafkaMonitor`, `createDatabaseMonitor`)**:
  - Pluggable, framework-agnostic instrumentation wrappers for Express, Fastify, Hono, KafkaJS, Prisma, and Mongoose.

---

## 2. Installation & Workspace Usage

In any application or package within the Larekmart monorepo:

```json
{
  "dependencies": {
    "@repo/monitoring": "workspace:*"
  }
}
```

Import public APIs via:

```typescript
import {
  createLogger,
  createHealthRegistry,
  createMetricsRegistry,
  createHttpMonitor,
  createKafkaMonitor,
  measureAsync,
  AppError,
} from "@repo/monitoring";
```

---

## 3. Environment Variables

The package automatically adapts based on standard environment variables:

| Variable                  | Type      | Default                       | Description                                                    |
| :------------------------ | :-------- | :---------------------------- | :------------------------------------------------------------- |
| `NODE_ENV`                | `string`  | `development`                 | `development` (pretty logs) vs `production` (JSON logs).       |
| `LOG_LEVEL`               | `string`  | `info` (prod) / `debug` (dev) | Minimum log level (`debug`, `info`, `warn`, `error`, `fatal`). |
| `LOG_FORMAT`              | `string`  | `pretty` / `json`             | Force output format (`json` or `pretty`).                      |
| `SERVICE_NAME`            | `string`  | —                             | Fallback service identifier.                                   |
| `MONITORING_ENABLED`      | `boolean` | `true`                        | Globally toggle monitoring features.                           |
| `HEALTH_CHECK_TIMEOUT_MS` | `number`  | `5000`                        | Default timeout for health checks.                             |

---

## 4. Usage Examples

### 4.1 Structured Logging

```typescript
import { createLogger } from "@repo/monitoring";

const logger = createLogger("order-service");

logger.info("Order created successfully", {
  orderId: "ord_123",
  amount: 49.99,
});

// Create request-scoped child logger
const reqLogger = logger.child({ requestId: "req_abc123", userId: "user_99" });
reqLogger.debug("Fetching user orders");
reqLogger.error("Failed to persist order", new Error("DB Connection timeout"));
```

### 4.2 Health Checks & Service Status

```typescript
import {
  createHealthRegistry,
  createMemoryCheck,
  createDbCheck,
} from "@repo/monitoring";
import { prisma } from "@repo/product-db";

const health = createHealthRegistry("product-service", "1.0.0");

// Register checks
health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});
health.register(
  "postgres",
  createDbCheck("PostgreSQL", () => prisma.$queryRaw`SELECT 1`),
  { critical: true },
);

// Expose in HTTP route
app.get("/health", async (req, res) => {
  const report = await health.runChecks();
  const statusCode = report.status === "unhealthy" ? 503 : 200;
  res.status(statusCode).json(report);
});
```

### 4.3 Metrics Collection

```typescript
import { createMetricsRegistry } from "@repo/monitoring";

const metrics = createMetricsRegistry("analytic-service");

// Record custom metrics
metrics.increment("orders_processed_total", 1, { payment_method: "stripe" });
metrics.setGauge("active_websocket_connections", 42);
metrics.observe("order_processing_duration_ms", 124.5, { status: "success" });

// Get snapshot for internal consumption
const snapshot = metrics.getSnapshot();

// Format as standard Prometheus text for GET /metrics endpoint
const prometheusText = metrics.toPrometheus();

```

### 4.4 Performance Timing

```typescript
import { measureAsync, startTimer } from "@repo/monitoring";

// Wrapper style
const { result } = await measureAsync(
  "fetchCatalog",
  async () => {
    return await fetchProductsFromDb();
  },
  { logger, logSlowThresholdMs: 250 },
);

// Stopwatch style
const timer = startTimer("stripe_charge");
await processStripePayment();
const durationMs = timer.stop();
```

### 4.5 Error Classification

```typescript
import { AppError, captureError } from "@repo/monitoring";

try {
  throw new AppError("Invalid product variant", {
    statusCode: 400,
    code: "INVALID_VARIANT",
  });
} catch (err) {
  captureError(err, { serviceName: "product-service", logger, metrics });
}
```

---

## 5. Development & Testing

```bash
# Type check package
pnpm --filter @repo/monitoring check-types

# Format source files
pnpm format
```
