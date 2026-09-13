/**
 * Product-service observability: one logger and one metrics registry for the
 * whole service, plus the cache counters the catalog cache reports into.
 *
 * The registry is exported (rather than created in `src/index.ts`) so the cache
 * modules can increment counters without importing the server bootstrap.
 */
import {
  createCacheMetrics,
  createLogger,
  createMetricsRegistry,
} from "@repo/monitoring";

const SERVICE_NAME = "product-service";

export const logger = createLogger(SERVICE_NAME);
export const metrics = createMetricsRegistry(SERVICE_NAME);

/**
 * Cache effectiveness counters, exposed at `GET /metrics` as
 * `cache_hits_total` / `cache_misses_total` / `cache_errors_total`, labelled by
 * `cache_type` (`products`, `product`, `categories`).
 *
 * `cache_errors_total` counts reads that failed because Redis was unreachable,
 * so a Redis outage cannot be mistaken for a cold cache. `createCacheMetrics`
 * owns that classification for every service.
 */
export const cacheMetrics = createCacheMetrics(metrics);
