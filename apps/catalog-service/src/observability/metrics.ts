import {
  createCacheMetrics,
  createCounter,
  createHistogram,
  createLogger,
  createMetricsRegistry,
} from "@repo/monitoring";

const SERVICE_NAME = "catalog-service";

export const logger = createLogger(SERVICE_NAME);
export const metrics = createMetricsRegistry(SERVICE_NAME);
export const cacheMetrics = createCacheMetrics(metrics);

export const catalogRequestsCounter = createCounter(
  metrics,
  "catalog_requests_total",
  "Total catalog lookup requests",
);

export const catalogEventsConsumedCounter = createCounter(
  metrics,
  "catalog_events_consumed_total",
  "Total domain events consumed by catalog projectors",
);

export const catalogQueryDuration = createHistogram(
  metrics,
  "catalog_query_duration_seconds",
  "Duration of catalog queries in seconds",
);

export const httpMetrics = {
  requestsTotal: createCounter(
    metrics,
    "catalog_http_requests_total",
    "Total HTTP requests to catalog-service",
  ),
  requestDuration: createHistogram(
    metrics,
    "catalog_http_request_duration_seconds",
    "HTTP request duration in seconds",
  ),
};
