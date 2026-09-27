import {
  createLogger,
  createMetricsRegistry,
  createHealthRegistry,
  createHttpMonitor,
  createMemoryCheck,
  createDbCheck,
  createCounter,
  createHistogram,
} from "@repo/monitoring";
import { prisma } from "@repo/user-db";

const SERVICE_NAME = "user-service";

export const logger = createLogger(SERVICE_NAME);
export const metrics = createMetricsRegistry(SERVICE_NAME);
export const httpMonitor = createHttpMonitor(logger, metrics);
export const health = createHealthRegistry(SERVICE_NAME, "1.0.0");

health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});
health.register(
  "postgres",
  createDbCheck("PostgreSQL", async () => {
    await prisma.$queryRaw`SELECT 1`;
  }),
  { critical: true },
);

export const userMetrics = {
  requestsTotal: createCounter(
    metrics,
    "user_requests_total",
    "Total user service HTTP requests",
  ),
  requestDurationSeconds: createHistogram(
    metrics,
    "user_request_duration_seconds",
    "Duration of user service requests in seconds",
  ),
  cacheHits: createCounter(
    metrics,
    "user_cache_hits_total",
    "Total cache hits in user-service",
  ),
  cacheMisses: createCounter(
    metrics,
    "user_cache_misses_total",
    "Total cache misses in user-service",
  ),
  usersCreated: createCounter(
    metrics,
    "user_created_total",
    "Total users created in user-service",
  ),
  usersUpdated: createCounter(
    metrics,
    "user_updated_total",
    "Total users updated in user-service",
  ),
  addressesCreated: createCounter(
    metrics,
    "address_created_total",
    "Total addresses created in user-service",
  ),
  addressesUpdated: createCounter(
    metrics,
    "address_updated_total",
    "Total addresses updated in user-service",
  ),
  kafkaEventsConsumed: createCounter(
    metrics,
    "kafka_events_consumed_total",
    "Total Kafka events consumed by user-service",
  ),
  kafkaEventsFailed: createCounter(
    metrics,
    "kafka_events_failed_total",
    "Total Kafka event processing failures in user-service",
  ),
};
