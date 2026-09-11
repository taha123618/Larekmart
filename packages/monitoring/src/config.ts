import type { Environment, LogLevel, MonitoringConfig } from "@repo/types";

const VALID_LOG_LEVELS: readonly LogLevel[] = [
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
];
const VALID_ENVIRONMENTS: readonly Environment[] = [
  "development",
  "production",
  "test",
];

function parseLogLevel(
  val: string | undefined,
  defaultLevel: LogLevel,
): LogLevel {
  if (!val) return defaultLevel;
  const normalized = val.toLowerCase().trim() as LogLevel;
  return VALID_LOG_LEVELS.includes(normalized) ? normalized : defaultLevel;
}

function parseEnvironment(val: string | undefined): Environment {
  if (!val) return "development";
  const normalized = val.toLowerCase().trim() as Environment;
  return VALID_ENVIRONMENTS.includes(normalized) ? normalized : "development";
}

/**
 * Resolves environment-aware monitoring configuration from process.env and overrides.
 */
export function getMonitoringConfig(
  serviceName: string,
  overrides: Partial<MonitoringConfig> = {},
): MonitoringConfig {
  const environment =
    overrides.environment ?? parseEnvironment(process.env.NODE_ENV);
  const isProd = environment === "production";

  const defaultLogLevel: LogLevel = isProd ? "info" : "debug";
  const logLevel =
    overrides.logLevel ?? parseLogLevel(process.env.LOG_LEVEL, defaultLogLevel);

  const enabled =
    overrides.enabled ??
    (process.env.MONITORING_ENABLED !== "false" &&
      process.env.MONITORING_ENABLED !== "0");

  const prettyLogs =
    overrides.prettyLogs ?? (!isProd && process.env.LOG_FORMAT !== "json");

  const metricsEnabled =
    overrides.metricsEnabled ?? process.env.METRICS_ENABLED !== "false";

  const healthCheckTimeoutMs =
    overrides.healthCheckTimeoutMs ??
    (process.env.HEALTH_CHECK_TIMEOUT_MS
      ? parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS, 10)
      : 5000);

  return {
    serviceName:
      overrides.serviceName || process.env.SERVICE_NAME || serviceName,
    environment,
    logLevel,
    enabled,
    prettyLogs,
    metricsEnabled,
    healthCheckTimeoutMs,
  };
}
