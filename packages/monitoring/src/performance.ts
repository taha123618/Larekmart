import type {
  MetricLabels,
  PerformanceRecord,
  PerformanceTimer,
} from "./types.js";
import type { Logger } from "./logger.js";
import type { MetricsRegistry } from "./metrics.js";

export interface MeasureOptions {
  labels?: MetricLabels;
  metadata?: Record<string, unknown>;
  logger?: Logger;
  metrics?: MetricsRegistry;
  logSlowThresholdMs?: number;
}

/**
 * Starts a manual performance stopwatch timer.
 */
export function startTimer(
  name: string,
  initialLabels: MetricLabels = {},
): PerformanceTimer {
  const startTime = performance.now();
  let stopped = false;

  return {
    name,
    startTime,
    labels: initialLabels,
    stop: (extraLabels?: MetricLabels): number => {
      if (stopped) return 0;
      stopped = true;
      const durationMs =
        Math.round((performance.now() - startTime) * 100) / 100;
      return durationMs;
    },
  };
}

/**
 * Executes and measures the duration of an asynchronous operation.
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  options: MeasureOptions = {},
): Promise<{ result: T; record: PerformanceRecord }> {
  const start = performance.now();
  let success = true;
  let error: unknown = undefined;

  try {
    const result = await fn();
    return {
      result,
      record: finishMeasurement(name, start, true, options),
    };
  } catch (err) {
    success = false;
    error = err;
    finishMeasurement(name, start, false, options, err);
    throw err;
  }
}

/**
 * Executes and measures the duration of a synchronous operation.
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  options: MeasureOptions = {},
): { result: T; record: PerformanceRecord } {
  const start = performance.now();
  try {
    const result = fn();
    return {
      result,
      record: finishMeasurement(name, start, true, options),
    };
  } catch (err) {
    finishMeasurement(name, start, false, options, err);
    throw err;
  }
}

function finishMeasurement(
  name: string,
  startTime: number,
  success: boolean,
  options: MeasureOptions,
  error?: unknown,
): PerformanceRecord {
  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
  const record: PerformanceRecord = {
    name,
    durationMs,
    timestamp: new Date().toISOString(),
    success,
    labels: options.labels,
    metadata: options.metadata,
  };

  if (options.metrics) {
    options.metrics.observe(`perf_${name}_duration_ms`, durationMs, {
      ...options.labels,
      success: String(success),
    });
  }

  if (options.logger) {
    const isSlow =
      options.logSlowThresholdMs !== undefined &&
      durationMs > options.logSlowThresholdMs;
    if (!success) {
      options.logger.error(
        `Operation '${name}' failed after ${durationMs}ms`,
        error,
        {
          durationMs,
          ...options.labels,
          ...options.metadata,
        },
      );
    } else if (isSlow) {
      options.logger.warn(
        `Slow operation '${name}' completed in ${durationMs}ms`,
        {
          durationMs,
          thresholdMs: options.logSlowThresholdMs,
          ...options.labels,
          ...options.metadata,
        },
      );
    } else {
      options.logger.debug(`Operation '${name}' completed in ${durationMs}ms`, {
        durationMs,
        ...options.labels,
        ...options.metadata,
      });
    }
  }

  return record;
}
