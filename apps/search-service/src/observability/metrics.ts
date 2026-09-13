import {
  createCacheMetrics,
  createCounter,
  createHistogram,
  createLogger,
  createMetricsRegistry,
} from "@repo/monitoring";
import { config } from "../config/config.js";

export const logger = createLogger(config.monitoring.serviceName);
export const metrics = createMetricsRegistry(config.monitoring.serviceName);

/**
 * Cache counters shared with every other service: `cache_hits_total`,
 * `cache_misses_total`, and `cache_errors_total` labelled by `cache_type`
 * (`search`, `suggestion`). Errors are reads that failed because Redis was
 * unreachable — not misses.
 */
export const cacheMetrics = createCacheMetrics(metrics);

export const searchMetrics = {
  // Counters
  searchRequestsTotal: createCounter(
    metrics,
    "search_requests_total",
    "Total number of product search requests",
  ),
  searchErrorsTotal: createCounter(
    metrics,
    "search_errors_total",
    "Total number of failed search operations",
  ),
  opensearchRequestsTotal: createCounter(
    metrics,
    "opensearch_requests_total",
    "Total OpenSearch operations executed",
  ),
  kafkaEventsProcessedTotal: createCounter(
    metrics,
    "kafka_events_processed_total",
    "Total Kafka product events processed by search-service",
  ),
  indexingDocumentsTotal: createCounter(
    metrics,
    "indexing_documents_total",
    "Total product documents indexed or updated in OpenSearch",
  ),

  // Histograms
  searchDurationSeconds: createHistogram(
    metrics,
    "search_request_duration_seconds",
    "Duration of product search requests in seconds",
  ),
  opensearchDurationSeconds: createHistogram(
    metrics,
    "opensearch_request_duration_seconds",
    "Duration of OpenSearch queries in seconds",
  ),
};
