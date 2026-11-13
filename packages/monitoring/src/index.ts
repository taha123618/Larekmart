// Configuration
export { getMonitoringConfig } from "./config.js";

// Logger
export { Logger, createLogger } from "./logger.js";

// Health Checks
export {
  HealthRegistry,
  createHealthRegistry,
  createMemoryCheck,
  createDbCheck,
  createHttpPingCheck,
} from "./health.js";

// Metrics
export {
  MetricsRegistry,
  createMetricsRegistry,
  createCounter,
  createGauge,
  createCacheMetrics,
  createHistogram,
} from "./metrics.js";
export type {
  CacheMetrics,
  CacheReadOutcome,
  MetricCounter,
  MetricGauge,
  MetricHistogram,
} from "./metrics.js";

// Performance Instrumentation
export { startTimer, measureAsync, measureSync } from "./performance.js";
export type { MeasureOptions } from "./performance.js";

// Error Tracking & Normalization
export {
  AppError,
  formatError,
  isOperationalError,
  captureError,
} from "./errors.js";
export type { CaptureErrorContext } from "./errors.js";

// Framework-agnostic Monitoring Hooks (HTTP, Kafka, DB)
export {
  createHttpMonitor,
  createKafkaMonitor,
  createDatabaseMonitor,
} from "./hooks.js";

// Distributed Tracing (OpenTelemetry & W3C Trace Context)
export {
  generateTraceId,
  generateSpanId,
  createTraceparent,
  parseTraceparent,
  getTraceContext,
  runWithTraceContext,
  extractTraceContext,
  injectTraceContext,
  withSpan,
  initTelemetry,
  Tracer,
  Span,
} from "./tracing/index.js";
export type {
  ParsedTraceparent,
  TraceContext,
  SpanKind,
  SpanStatusCode,
  SpanAttributes,
  SpanEvent,
  SpanStatus,
  SpanData,
  TelemetryConfig,
} from "./tracing/index.js";

// Automated Synthetic Canary & E2E Health Prober
export {
  CanaryProber,
  InMemoryCanaryStorage,
  SYNTHETIC_PROBE_HEADER,
  CANARY_SKU_ID,
  CANARY_VARIANT_ID,
  CANARY_USER_ID,
} from "./canary/index.js";
export type {
  CanaryScenarioType,
  CanaryStepResult,
  CanaryProbeRun,
  CanarySlaStats,
  CanaryProbeOptions,
  CanaryStorageAdapter,
} from "./canary/index.js";

// Types
export type {
  LogLevel,
  Environment,
  LogMetadata,
  LogEntry,
  LoggerOptions,
  HealthStatus,
  HealthCheckResult,
  HealthCheckFn,
  RegisteredHealthCheck,
  ServiceHealthReport,
  MetricType,
  MetricLabels,
  MetricRecord,
  HistogramSnapshot,
  MetricsSnapshot,
  PerformanceTimer,
  PerformanceRecord,
  MonitoringConfig,
  HttpRequestContext,
  KafkaEventContext,
  FormattedError,
  CaptureErrorOptions,
} from "@repo/types";
