import {
  generateSpanId,
  generateTraceId,
  createTraceparent,
} from "./w3c.js";
import {
  getTraceContext,
  runWithTraceContext,
  type TraceContext,
} from "./context.js";

export type SpanKind = "INTERNAL" | "SERVER" | "CLIENT" | "PRODUCER" | "CONSUMER";
export type SpanStatusCode = "UNSET" | "OK" | "ERROR";

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface SpanEvent {
  name: string;
  timestamp: string;
  attributes?: SpanAttributes;
}

export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: SpanAttributes;
  events: SpanEvent[];
  status: SpanStatus;
  serviceName: string;
}

export class Span {
  public readonly traceId: string;
  public readonly spanId: string;
  public readonly parentSpanId?: string;
  public readonly name: string;
  public readonly kind: SpanKind;
  public readonly startTime: bigint;
  private endTime?: bigint;
  private attributes: SpanAttributes;
  private events: SpanEvent[] = [];
  private status: SpanStatus = { code: "UNSET" };
  private ended = false;
  private readonly serviceName: string;

  constructor(
    name: string,
    context: TraceContext,
    serviceName: string,
    options: {
      kind?: SpanKind;
      attributes?: SpanAttributes;
    } = {},
  ) {
    this.name = name;
    this.traceId = context.traceId;
    this.spanId = context.spanId;
    this.parentSpanId = context.parentSpanId;
    this.serviceName = serviceName;
    this.kind = options.kind || "INTERNAL";
    this.attributes = { ...options.attributes };
    this.startTime = process.hrtime.bigint();
  }

  public setAttribute(key: string, value: string | number | boolean | undefined): this {
    if (this.ended || value === undefined) return this;
    this.attributes[key] = value;
    return this;
  }

  public setAttributes(attributes: SpanAttributes): this {
    if (this.ended) return this;
    Object.assign(this.attributes, attributes);
    return this;
  }

  public addEvent(name: string, attributes?: SpanAttributes): this {
    if (this.ended) return this;
    this.events.push({
      name,
      timestamp: new Date().toISOString(),
      attributes,
    });
    return this;
  }

  public setStatus(code: SpanStatusCode, message?: string): this {
    if (this.ended) return this;
    this.status = { code, message };
    return this;
  }

  public recordException(error: unknown): this {
    if (this.ended) return this;
    this.status = {
      code: "ERROR",
      message: error instanceof Error ? error.message : String(error),
    };
    this.addEvent("exception", {
      "exception.type": error instanceof Error ? error.name : "Error",
      "exception.message": error instanceof Error ? error.message : String(error),
      "exception.stacktrace": error instanceof Error ? error.stack : undefined,
    });
    return this;
  }

  public end(): void {
    if (this.ended) return;
    this.ended = true;
    this.endTime = process.hrtime.bigint();

    const spanData: SpanData = {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      startTimeUnixNano: this.startTime.toString(),
      endTimeUnixNano: this.endTime.toString(),
      attributes: this.attributes,
      events: this.events,
      status: this.status,
      serviceName: this.serviceName,
    };

    Tracer.getInstance().enqueue(spanData);
  }
}

export interface TelemetryConfig {
  serviceName: string;
  otlpEndpoint?: string;
  enabled?: boolean;
}

export class Tracer {
  private static instance: Tracer | null = null;
  private serviceName: string = "unknown-service";
  private otlpEndpoint: string = "http://localhost:4318";
  private enabled: boolean = true;
  private queue: SpanData[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private readonly maxQueueSize = 2000;
  private readonly batchSize = 200;

  private constructor() {
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, 2000);

    if (typeof this.flushTimer.unref === "function") {
      this.flushTimer.unref();
    }
  }

  public static getInstance(): Tracer {
    if (!Tracer.instance) {
      Tracer.instance = new Tracer();
    }
    return Tracer.instance;
  }

  public init(config: TelemetryConfig): void {
    this.serviceName = config.serviceName;
    this.otlpEndpoint =
      config.otlpEndpoint ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      process.env.OTEL_COLLECTOR_URL ||
      "http://localhost:4318";

    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    } else {
      this.enabled =
        process.env.OTEL_TRACING_ENABLED !== "false" &&
        process.env.NODE_ENV !== "test";
    }
  }

  public getServiceName(): string {
    return this.serviceName;
  }

  public enqueue(span: SpanData): void {
    if (!this.enabled) return;
    if (this.queue.length >= this.maxQueueSize) {
      // Discard oldest span if buffer is saturated under extreme surge
      this.queue.shift();
    }
    this.queue.push(span);

    if (this.queue.length >= this.batchSize) {
      this.flush().catch(() => {});
    }
  }

  public async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0 || !this.enabled) return;
    this.isFlushing = true;

    const batch = this.queue.splice(0, this.batchSize);

    try {
      const payload = this.formatOtlpBatch(batch);
      const url = `${this.otlpEndpoint.replace(/\/$/, "")}/v1/traces`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000),
      }).catch(() => null);

      if (!res || !res.ok) {
        // Collector temporarily offline or backpressure — drop batch gracefully
      }
    } catch {
      // Non-blocking telemetry delivery
    } finally {
      this.isFlushing = false;
    }
  }

  private formatOtlpBatch(spans: SpanData[]) {
    // Group spans by service name
    const spansByService = new Map<string, SpanData[]>();
    for (const s of spans) {
      const list = spansByService.get(s.serviceName) || [];
      list.push(s);
      spansByService.set(s.serviceName, list);
    }

    const resourceSpans = [];

    for (const [svcName, svcSpans] of spansByService.entries()) {
      resourceSpans.push({
        resource: {
          attributes: [
            {
              key: "service.name",
              value: { stringValue: svcName },
            },
            {
              key: "telemetry.sdk.language",
              value: { stringValue: "nodejs" },
            },
            {
              key: "telemetry.sdk.name",
              value: { stringValue: "@repo/monitoring" },
            },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "@repo/monitoring", version: "0.0.1" },
            spans: svcSpans.map((span) => ({
              traceId: span.traceId,
              spanId: span.spanId,
              parentSpanId: span.parentSpanId || "",
              name: span.name,
              kind: this.mapKindToNumber(span.kind),
              startTimeUnixNano: span.startTimeUnixNano,
              endTimeUnixNano: span.endTimeUnixNano,
              attributes: Object.entries(span.attributes).map(([k, v]) => ({
                key: k,
                value: this.formatAttributeValue(v),
              })),
              events: span.events.map((e) => ({
                timeUnixNano: (new Date(e.timestamp).getTime() * 1_000_000).toString(),
                name: e.name,
                attributes: Object.entries(e.attributes || {}).map(([k, v]) => ({
                  key: k,
                  value: this.formatAttributeValue(v),
                })),
              })),
              status: {
                code: span.status.code === "OK" ? 1 : span.status.code === "ERROR" ? 2 : 0,
                message: span.status.message || "",
              },
            })),
          },
        ],
      });
    }

    return { resourceSpans };
  }

  private mapKindToNumber(kind: SpanKind): number {
    switch (kind) {
      case "INTERNAL":
        return 1;
      case "SERVER":
        return 2;
      case "CLIENT":
        return 3;
      case "PRODUCER":
        return 4;
      case "CONSUMER":
        return 5;
      default:
        return 1;
    }
  }

  private formatAttributeValue(v: string | number | boolean | undefined) {
    if (typeof v === "boolean") return { boolValue: v };
    if (typeof v === "number") {
      return Number.isInteger(v) ? { intValue: v.toString() } : { doubleValue: v };
    }
    return { stringValue: String(v ?? "") };
  }
}

/**
 * Convenience helper to wrap an asynchronous execution in a managed OpenTelemetry span.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  options?: {
    kind?: SpanKind;
    attributes?: SpanAttributes;
    parentContext?: TraceContext;
  },
): Promise<T> {
  const parent = options?.parentContext || getTraceContext();
  const traceId = parent?.traceId || generateTraceId();
  const spanId = generateSpanId();
  const currentContext: TraceContext = {
    traceId,
    spanId,
    parentSpanId: parent?.spanId,
    correlationId: parent?.correlationId,
    sampled: parent?.sampled ?? true,
  };

  const serviceName = Tracer.getInstance().getServiceName();
  const span = new Span(name, currentContext, serviceName, {
    kind: options?.kind,
    attributes: options?.attributes,
  });

  return runWithTraceContext(currentContext, async () => {
    try {
      const result = await fn(span);
      span.setStatus("OK");
      return result;
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Initializes global telemetry for a service.
 */
export function initTelemetry(config: TelemetryConfig): Tracer {
  const tracer = Tracer.getInstance();
  tracer.init(config);
  return tracer;
}
