import type { FastifyRequest } from "fastify";
import { v4 as uuidv4 } from "uuid";

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceparent?: string;
  baggage?: string;
}

/**
 * Parses or synthesizes a W3C traceparent header:
 * version-trace_id-parent_id-trace_flags (e.g. 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
 */
export function extractOrCreateTraceContext(request: FastifyRequest): TraceContext {
  const incomingTraceparent = request.headers["traceparent"];
  const incomingBaggage = request.headers["baggage"];

  if (typeof incomingTraceparent === "string" && incomingTraceparent.startsWith("00-")) {
    const parts = incomingTraceparent.split("-");
    if (parts.length === 4) {
      const traceId = parts[1] || uuidv4().replace(/-/g, "");
      const spanId = parts[2] || uuidv4().replace(/-/g, "").substring(0, 16);
      return {
        traceId,
        spanId,
        traceparent: incomingTraceparent,
        baggage: typeof incomingBaggage === "string" ? incomingBaggage : undefined,
      };
    }
  }

  // Synthesize W3C compliant traceparent
  const traceId = uuidv4().replace(/-/g, "");
  const spanId = uuidv4().replace(/-/g, "").substring(0, 16);
  const traceparent = `00-${traceId}-${spanId}-01`;

  return {
    traceId,
    spanId,
    traceparent,
    baggage: typeof incomingBaggage === "string" ? incomingBaggage : undefined,
  };
}

export function injectTraceHeaders(
  headers: Record<string, string | string[] | undefined>,
  traceContext: TraceContext,
): void {
  if (traceContext.traceparent) {
    headers["traceparent"] = traceContext.traceparent;
  }
  if (traceContext.baggage) {
    headers["baggage"] = traceContext.baggage;
  }
}
