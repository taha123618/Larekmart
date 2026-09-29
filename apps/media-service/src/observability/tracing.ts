import type { Context, MiddlewareHandler, Next } from "hono";
import { randomUUID } from "node:crypto";

/**
 * Observability context propagation.
 *
 * OpenTelemetry JS SDK is not currently a dependency of any Node service in
 * this monorepo (only Go/Python use it), so to avoid introducing a duplicate
 * observability stack we implement the propagation layer here: every request
 * gets a request_id + trace context read from W3C `traceparent` headers when
 * present, and every processing job gets a job_id + trace identifiers. This
 * keeps request_id / trace_id / span_id correlation (spec section 38) working
 * with the repository's shared monitoring stack; a full OTLP exporter can be
 * enabled later without touching call sites.
 */

export interface RequestContext {
  requestId: string;
  traceId: string;
  spanId: string;
  userId: string | null;
  mediaId: string | null;
  ownerType: string | null;
  ownerId: string | null;
}

const CONTEXT_KEY = "media:requestContext";

/** Extracts W3C trace context from a `traceparent` header when present. */
function parseTraceparent(
  header: string | undefined,
): { traceId: string; spanId: string } | null {
  if (!header) return null;
  // Format: <version>-<trace-id>-<parent-span-id>-<flags>
  const parts = header.split("-");
  if (parts.length !== 4) return null;
  const [, traceId, spanId] = parts;
  if (
    !traceId ||
    !spanId ||
    traceId.length !== 32 ||
    spanId.length !== 16 ||
    /^0+$/.test(traceId) ||
    /^0+$/.test(spanId)
  ) {
    return null;
  }
  return { traceId, spanId };
}

/**
 * Middleware that establishes the per-request observability context and
 * echoes request/trace ids in response headers for cross-service correlation.
 */
export const requestContextMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const parsed = parseTraceparent(c.req.header("traceparent"));
  const requestId =
    c.req.header("x-request-id") ??
    c.req.header("x-correlation-id") ??
    randomUUID();

  const context: RequestContext = {
    requestId,
    traceId: parsed?.traceId ?? requestId.replace(/-/g, "").slice(0, 32),
    spanId: parsed?.spanId ?? randomUUID().replace(/-/g, "").slice(0, 16),
    userId: null,
    mediaId: null,
    ownerType: null,
    ownerId: null,
  };

  c.set(CONTEXT_KEY, context);

  await next();

  c.res.headers.set("x-request-id", context.requestId);
  c.res.headers.set("x-trace-id", context.traceId);
};

export function getRequestContext(c: Context): RequestContext | undefined {
  return c.get(CONTEXT_KEY);
}

/** Builds structured log/metadata fields from the request context. */
export function traceFields(c: Context | null): Record<string, string | null> {
  if (!c) return {};
  const ctx = getRequestContext(c);
  if (!ctx) return {};
  return {
    requestId: ctx.requestId,
    traceId: ctx.traceId,
    spanId: ctx.spanId,
  };
}

/** Creates observability fields for an async processing job. */
export function jobTraceFields(job: {
  id: string;
  mediaId: string;
  jobType: string;
  attempt: number;
}): Record<string, string | number> {
  return {
    jobId: job.id,
    mediaId: job.mediaId,
    processingType: job.jobType,
    attempt: job.attempt,
  };
}
