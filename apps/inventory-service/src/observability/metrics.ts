import {
  createCacheMetrics,
  createLogger,
  createMetricsRegistry,
} from "@repo/monitoring";

export const logger = createLogger("inventory-service");
export const metrics = createMetricsRegistry("inventory-service");
export const cacheMetrics = createCacheMetrics(metrics);
