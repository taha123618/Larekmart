import {
  createCacheMetrics,
  createCounter,
  createHistogram,
  createLogger,
  createMetricsRegistry,
} from "@repo/monitoring";

export const logger = createLogger("media-service");
export const metrics = createMetricsRegistry("media-service");
export const cacheMetrics = createCacheMetrics(metrics);

/**
 * All media-specific Prometheus counters/histograms. Served at `/metrics`
 * via MetricsRegistry.toPrometheus().
 */
export const mediaMetrics = {
  media_uploads_total: createCounter(
    metrics,
    "media_uploads_total",
    "Total media upload sessions created",
  ),
  media_upload_failures_total: createCounter(
    metrics,
    "media_upload_failures_total",
    "Total failed upload creations or completions",
  ),
  media_processing_total: createCounter(
    metrics,
    "media_processing_total",
    "Total media processing jobs executed",
  ),
  media_processing_failures_total: createCounter(
    metrics,
    "media_processing_failures_total",
    "Total failed media processing jobs",
  ),
  media_processing_duration_seconds: createHistogram(
    metrics,
    "media_processing_duration_seconds",
    "Duration of media processing jobs in seconds",
  ),
  media_download_requests_total: createCounter(
    metrics,
    "media_download_requests_total",
    "Total download URL generations",
  ),
  media_cache_hits_total: createCounter(
    metrics,
    "media_cache_hits_total",
    "Total metadata cache hits",
  ),
  media_cache_misses_total: createCounter(
    metrics,
    "media_cache_misses_total",
    "Total metadata cache misses",
  ),
  media_deleted_total: createCounter(
    metrics,
    "media_deleted_total",
    "Total media soft-deletes",
  ),
  media_quarantined_total: createCounter(
    metrics,
    "media_quarantined_total",
    "Total media quarantines",
  ),
  kafka_events_consumed_total: createCounter(
    metrics,
    "kafka_events_consumed_total",
    "Total Kafka events consumed",
  ),
  kafka_events_published_total: createCounter(
    metrics,
    "kafka_events_published_total",
    "Total Kafka events published",
  ),
  kafka_event_failures_total: createCounter(
    metrics,
    "kafka_event_failures_total",
    "Total Kafka publish/consume failures",
  ),
  s3_operation_total: createCounter(
    metrics,
    "s3_operation_total",
    "Total S3/MinIO operations",
  ),
  s3_operation_failures_total: createCounter(
    metrics,
    "s3_operation_failures_total",
    "Total failed S3/MinIO operations",
  ),
};
