export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type Environment = "development" | "production" | "test";

export interface LogMetadata {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: Environment;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  metadata?: LogMetadata;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
    details?: unknown;
  };
}

export interface LoggerOptions {
  serviceName: string;
  environment?: Environment;
  minLevel?: LogLevel;
  defaultMetadata?: LogMetadata;
  prettyPrint?: boolean;
}

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  status: HealthStatus;
  latencyMs: number;
  message?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export type HealthCheckFn = () =>
  | Promise<HealthCheckResult>
  | HealthCheckResult;

export interface RegisteredHealthCheck {
  name: string;
  check: HealthCheckFn;
  critical: boolean;
  timeoutMs: number;
}

export interface ServiceHealthReport {
  service: string;
  status: HealthStatus;
  uptimeSeconds: number;
  timestamp: string;
  version?: string;
  checks: Record<string, HealthCheckResult>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export type MetricType = "counter" | "gauge" | "histogram";

export interface MetricLabels {
  [key: string]: string | number | boolean | undefined;
}

export interface MetricRecord {
  name: string;
  type: MetricType;
  value: number;
  labels: MetricLabels;
  timestamp: string;
  help?: string;
}

export interface HistogramSnapshot {
  name: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  labels: MetricLabels;
}

export interface MetricsSnapshot {
  service: string;
  timestamp: string;
  counters: MetricRecord[];
  gauges: MetricRecord[];
  histograms: HistogramSnapshot[];
}

export interface PerformanceTimer {
  name: string;
  startTime: number;
  labels?: MetricLabels;
  stop: (extraLabels?: MetricLabels) => number;
}

export interface PerformanceRecord {
  name: string;
  durationMs: number;
  timestamp: string;
  success: boolean;
  labels?: MetricLabels;
  metadata?: Record<string, unknown>;
}

export interface MonitoringConfig {
  serviceName: string;
  environment: Environment;
  logLevel: LogLevel;
  enabled: boolean;
  prettyLogs: boolean;
  metricsEnabled: boolean;
  healthCheckTimeoutMs: number;
}

export interface HttpRequestContext {
  method: string;
  url: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  requestId?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
}

export interface KafkaEventContext {
  topic: string;
  eventType?: string;
  partition?: number;
  offset?: string | number;
  durationMs?: number;
  success?: boolean;
  messageKey?: string;
  error?: Error;
}

export interface FormattedError {
  name: string;
  message: string;
  code?: string | number;
  statusCode?: number;
  isOperational: boolean;
  stack?: string;
  details?: unknown;
  timestamp: string;
}

export interface CaptureErrorOptions {
  serviceName?: string;
  requestId?: string;
  userId?: string;
  route?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}
