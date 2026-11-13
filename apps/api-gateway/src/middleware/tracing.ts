import type { FastifyInstance } from "fastify";
import { runWithTraceContext } from "@repo/monitoring";
import {
  extractOrCreateTraceContext,
  type TraceContext,
} from "../observability/tracing.js";

declare module "fastify" {
  interface FastifyRequest {
    traceContext?: TraceContext;
  }
}

export function registerTracingMiddleware(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", (request, reply, done) => {
    const traceCtx = extractOrCreateTraceContext(request);
    request.traceContext = traceCtx;

    if (traceCtx.traceparent) {
      request.headers["traceparent"] = traceCtx.traceparent;
      reply.header("traceparent", traceCtx.traceparent);
    }

    runWithTraceContext(
      {
        traceId: traceCtx.traceId,
        spanId: traceCtx.spanId,
        traceparent: traceCtx.traceparent,
        sampled: true,
      },
      () => done(),
    );
  });
}
