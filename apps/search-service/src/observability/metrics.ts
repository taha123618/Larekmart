import { createMetricsRegistry, createLogger } from "@repo/monitoring";
import { config } from "../config/config.js";

export const logger = createLogger(config.monitoring.serviceName);
export const metrics = createMetricsRegistry(config.monitoring.serviceName);

/**
 * Thin counter/histogram wrappers that match the MetricsRegistry.increment() /
 * MetricsRegistry.observe() API while exposing a Prometheus-style `.inc()` /
 * `.observe()` interface used throughout the service.
 */
function makeCounter(metricName: string, help?: string) {
  return {
    inc(labels: Record<string, string | number> = {}, value = 1) {
      metrics.increment(metricName, value, labels, help);
    },
  };
}

function makeHistogram(metricName: string, help?: string) {
  return {
    observe(labels: Record<string, string | number> = {}, value: number) {
      metrics.observe(metricName, value, labels, help);
    },
  };
}

export const searchMetrics = {
  // Counters
  searchRequestsTotal: makeCounter(
    "search_requests_total",
    "Total number of product search requests",
  ),
  searchErrorsTotal: makeCounter(
    "search_errors_total",
    "Total number of failed search operations",
  ),
  opensearchRequestsTotal: makeCounter(
    "opensearch_requests_total",
    "Total OpenSearch operations executed",
  ),
  cacheHitsTotal: makeCounter("cache_hits_total", "Total search cache hits"),
  cacheMissesTotal: makeCounter("cache_misses_total", "Total search cache misses"),
  kafkaEventsProcessedTotal: makeCounter(
    "kafka_events_processed_total",
    "Total Kafka product events processed by search-service",
  ),
  indexingDocumentsTotal: makeCounter(
    "indexing_documents_total",
    "Total product documents indexed or updated in OpenSearch",
  ),

  // Histograms
  searchDurationSeconds: makeHistogram(
    "search_request_duration_seconds",
    "Duration of product search requests in seconds",
  ),
  opensearchDurationSeconds: makeHistogram(
    "opensearch_request_duration_seconds",
    "Duration of OpenSearch queries in seconds",
  ),
};
