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
export { MetricsRegistry, createMetricsRegistry } from "./metrics.js";

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
export type { FormattedError } from "./errors.js";

// Framework-agnostic Monitoring Hooks (HTTP, Kafka, DB)
export {
  createHttpMonitor,
  createKafkaMonitor,
  createDatabaseMonitor,
} from "./hooks.js";

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
} from "./types.js";
