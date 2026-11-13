import { AsyncLocalStorage } from "node:async_hooks";
import {
  generateSpanId,
  generateTraceId,
  createTraceparent,
  parseTraceparent,
  type ParsedTraceparent,
} from "./w3c.js";

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  correlationId?: string;
  sampled: boolean;
  baggage?: Record<string, string>;
  traceparent?: string;
}

const traceLocalStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Returns the active trace context from AsyncLocalStorage, if any.
 */
export function getTraceContext(): TraceContext | undefined {
  return traceLocalStorage.getStore();
}

/**
 * Runs an asynchronous callback within a given or synthesized trace context.
 */
export function runWithTraceContext<T>(
  context: TraceContext,
  fn: () => Promise<T> | T,
): T | Promise<T> {
  return traceLocalStorage.run(context, fn);
}

/**
 * Extracts W3C traceparent and correlation identifiers from an HTTP or message carrier.
 */
export function extractTraceContext(
  carrier: Record<string, unknown> | null | undefined,
): TraceContext {
  if (!carrier) {
    const traceId = generateTraceId();
    const spanId = generateSpanId();
    return { traceId, spanId, sampled: true };
  }

  const rawTraceparent =
    (carrier["traceparent"] as string) ||
    (carrier["Traceparent"] as string) ||
    (carrier["x-traceparent"] as string);

  const rawCorrelationId =
    (carrier["x-correlation-id"] as string) ||
    (carrier["correlation-id"] as string) ||
    (carrier["correlationId"] as string);

  const parsed = parseTraceparent(rawTraceparent);
  if (parsed) {
    return {
      traceId: parsed.traceId,
      spanId: generateSpanId(),
      parentSpanId: parsed.parentId,
      correlationId: rawCorrelationId || undefined,
      sampled: parsed.sampled,
    };
  }

  // Fallback: check if B3 or custom headers exist
  const b3TraceId = carrier["x-b3-traceid"] as string | undefined;
  const traceId =
    b3TraceId && b3TraceId.length === 32 ? b3TraceId : generateTraceId();
  const spanId = generateSpanId();

  return {
    traceId,
    spanId,
    correlationId: rawCorrelationId || undefined,
    sampled: true,
  };
}

/**
 * Injects the active trace context as W3C traceparent and correlation headers into a carrier object.
 */
export function injectTraceContext(
  carrier: Record<string, string | string[] | undefined>,
  explicitContext?: TraceContext,
): void {
  const ctx = explicitContext || getTraceContext();
  if (!ctx) return;

  carrier["traceparent"] = createTraceparent(
    ctx.traceId,
    ctx.spanId,
    ctx.sampled,
  );
  if (ctx.correlationId) {
    carrier["x-correlation-id"] = ctx.correlationId;
  }
}
