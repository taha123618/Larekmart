import type {
  HistogramSnapshot,
  MetricLabels,
  MetricRecord,
  MetricsSnapshot,
} from "@repo/types";

function labelsToKey(labels: MetricLabels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  return keys.map((k) => `${k}=${labels[k]}`).join(",");
}

class Histogram {
  private values: number[] = [];
  private maxSamples: number;

  constructor(maxSamples: number = 1000) {
    this.maxSamples = maxSamples;
  }

  public record(val: number): void {
    if (this.values.length >= this.maxSamples) {
      this.values.shift();
    }
    this.values.push(val);
  }

  public getSnapshot(name: string, labels: MetricLabels): HistogramSnapshot {
    if (this.values.length === 0) {
      return {
        name,
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        labels,
      };
    }

    const sorted = [...this.values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, curr) => acc + curr, 0);
    const min = sorted[0] ?? 0;
    const max = sorted[count - 1] ?? 0;
    const avg = sum / count;

    const percentile = (p: number): number => {
      const idx = Math.min(Math.floor((p / 100) * count), count - 1);
      return sorted[idx] ?? 0;
    };

    return {
      name,
      count,
      sum,
      min,
      max,
      avg: Math.round(avg * 100) / 100,
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      labels,
    };
  }

  public reset(): void {
    this.values = [];
  }
}

export class MetricsRegistry {
  public readonly serviceName: string;
  private counters: Map<
    string,
    { value: number; labels: MetricLabels; help?: string }
  > = new Map();
  private gauges: Map<
    string,
    { value: number; labels: MetricLabels; help?: string }
  > = new Map();
  private histograms: Map<
    string,
    { histogram: Histogram; labels: MetricLabels; help?: string }
  > = new Map();

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Increments a counter metric by a given value (default 1).
   */
  public increment(
    name: string,
    value: number = 1,
    labels: MetricLabels = {},
    help?: string,
  ): void {
    const key = `${name}#${labelsToKey(labels)}`;
    const current = this.counters.get(key);
    if (current) {
      current.value += value;
    } else {
      this.counters.set(key, { value, labels, help });
    }
  }

  /**
   * Sets a gauge metric to an absolute value.
   */
  public setGauge(
    name: string,
    value: number,
    labels: MetricLabels = {},
    help?: string,
  ): void {
    const key = `${name}#${labelsToKey(labels)}`;
    this.gauges.set(key, { value, labels, help });
  }

  /**
   * Observes a sample value in a histogram (e.g. response time, payload size).
   */
  public observe(
    name: string,
    value: number,
    labels: MetricLabels = {},
    help?: string,
  ): void {
    const key = `${name}#${labelsToKey(labels)}`;
    let current = this.histograms.get(key);
    if (!current) {
      current = { histogram: new Histogram(), labels, help };
      this.histograms.set(key, current);
    }
    current.histogram.record(value);
  }

  /**
   * Records an HTTP request execution.
   */
  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    const labels: MetricLabels = {
      method: method.toUpperCase(),
      route,
      status: statusCode,
      status_class: `${Math.floor(statusCode / 100)}xx`,
    };

    this.increment(
      "http_requests_total",
      1,
      labels,
      "Total number of HTTP requests",
    );
    this.observe(
      "http_request_duration_ms",
      durationMs,
      labels,
      "HTTP request latency in milliseconds",
    );

    if (statusCode >= 400) {
      this.increment(
        "http_requests_errors_total",
        1,
        labels,
        "Total HTTP error responses",
      );
    }
  }

  /**
   * Records a Kafka message production or consumption.
   */
  public recordKafkaEvent(
    topic: string,
    action: "produce" | "consume",
    durationMs: number,
    success: boolean,
  ): void {
    const labels: MetricLabels = {
      topic,
      action,
      status: success ? "success" : "failure",
    };

    this.increment(
      "kafka_events_total",
      1,
      labels,
      "Total Kafka events processed",
    );
    this.observe(
      "kafka_event_duration_ms",
      durationMs,
      labels,
      "Kafka event processing duration",
    );

    if (!success) {
      this.increment(
        "kafka_event_errors_total",
        1,
        labels,
        "Total Kafka processing failures",
      );
    }
  }

  /**
   * Records a database query execution.
   */
  public recordDbQuery(
    dbType: "postgres" | "mongodb",
    operation: string,
    durationMs: number,
    success: boolean,
  ): void {
    const labels: MetricLabels = {
      db: dbType,
      op: operation,
      status: success ? "success" : "error",
    };

    this.increment(
      "db_queries_total",
      1,
      labels,
      "Total database queries executed",
    );
    this.observe(
      "db_query_duration_ms",
      durationMs,
      labels,
      "Database query latency in milliseconds",
    );
  }

  /**
   * Returns a point-in-time snapshot of all recorded metrics.
   */
  public getSnapshot(): MetricsSnapshot {
    const timestamp = new Date().toISOString();

    const counters: MetricRecord[] = Array.from(this.counters.entries()).map(
      ([key, data]) => ({
        name: key.split("#")[0] ?? key,
        type: "counter",
        value: data.value,
        labels: data.labels,
        timestamp,
        help: data.help,
      }),
    );

    const gauges: MetricRecord[] = Array.from(this.gauges.entries()).map(
      ([key, data]) => ({
        name: key.split("#")[0] ?? key,
        type: "gauge",
        value: data.value,
        labels: data.labels,
        timestamp,
        help: data.help,
      }),
    );

    const histograms: HistogramSnapshot[] = Array.from(
      this.histograms.entries(),
    ).map(([key, data]) => {
      const name = key.split("#")[0] ?? key;
      return data.histogram.getSnapshot(name, data.labels);
    });

    return {
      service: this.serviceName,
      timestamp,
      counters,
      gauges,
      histograms,
    };
  }

  /**
   * Serializes recorded metrics to the standard Prometheus text exposition format.
   */
  public toPrometheus(): string {
    const lines: string[] = [];
    const snapshot = this.getSnapshot();

    for (const counter of snapshot.counters) {
      if (counter.help) {
        lines.push(`# HELP ${counter.name} ${counter.help}`);
        lines.push(`# TYPE ${counter.name} counter`);
      }
      const labelStr = Object.entries(counter.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      const formattedLabels = labelStr ? `{${labelStr}}` : "";
      lines.push(`${counter.name}${formattedLabels} ${counter.value}`);
    }

    for (const gauge of snapshot.gauges) {
      if (gauge.help) {
        lines.push(`# HELP ${gauge.name} ${gauge.help}`);
        lines.push(`# TYPE ${gauge.name} gauge`);
      }
      const labelStr = Object.entries(gauge.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      const formattedLabels = labelStr ? `{${labelStr}}` : "";
      lines.push(`${gauge.name}${formattedLabels} ${gauge.value}`);
    }

    for (const hist of snapshot.histograms) {
      const labelStr = Object.entries(hist.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      const baseLabels = labelStr ? `${labelStr},` : "";
      lines.push(`${hist.name}_count{${labelStr}} ${hist.count}`);
      lines.push(`${hist.name}_sum{${labelStr}} ${hist.sum}`);
      lines.push(`${hist.name}{${baseLabels}quantile="0.5"} ${hist.p50}`);
      lines.push(`${hist.name}{${baseLabels}quantile="0.9"} ${hist.p90}`);
      lines.push(`${hist.name}{${baseLabels}quantile="0.99"} ${hist.p99}`);
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Resets all metric accumulators.
   */
  public reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

/**
 * Creates a new MetricsRegistry for a service.
 */
export function createMetricsRegistry(serviceName: string): MetricsRegistry {
  return new MetricsRegistry(serviceName);
}
