---
name: observability-integration
description: Recipes and patterns for integrating @repo/monitoring into Larekmart services and applications.
---

# Observability Integration Skill

Use this skill when instrumenting a service, endpoint, Kafka producer/consumer, or database call with `@repo/monitoring`.

## 1. Adding to a Service

Add the workspace dependency to `package.json`:

```json
{
  "dependencies": {
    "@repo/monitoring": "workspace:*"
  }
}
```

## 2. Standard Service Initialization Pattern

Create a centralized monitoring instance for the service (e.g. `src/utils/monitoring.ts`):

```typescript
import {
  createLogger,
  createHealthRegistry,
  createMetricsRegistry,
  createMemoryCheck,
} from "@repo/monitoring";

export const logger = createLogger("product-service");
export const metrics = createMetricsRegistry("product-service");
export const health = createHealthRegistry("product-service", "1.0.0");

// Default health checks
health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});
```

## 3. Instrumenting HTTP Endpoints

Expose standard health and metrics endpoints:

```typescript
// Health endpoint
app.get("/health", async (req, res) => {
  const report = await health.runChecks();
  const statusCode = report.status === "unhealthy" ? 503 : 200;
  res.status(statusCode).json(report);
});

// Metrics endpoint (admin/internal only)
app.get("/metrics", (req, res) => {
  res.json(metrics.getSnapshot());
});
```

## 4. Instrumenting Kafka Handlers

Wrap message consumption with `createKafkaMonitor`:

```typescript
import { createKafkaMonitor } from "@repo/monitoring";

const kafkaMonitor = createKafkaMonitor(logger, metrics);

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const tracker = kafkaMonitor.onMessageStart(topic, message.key?.toString());
    try {
      await handleMessage(message);
      tracker.onMessageComplete(true);
    } catch (err) {
      tracker.onMessageComplete(
        false,
        err instanceof Error ? err : new Error(String(err)),
      );
      throw err;
    }
  },
});
```
