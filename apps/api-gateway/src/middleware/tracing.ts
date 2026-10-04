import type { FastifyInstance } from "fastify";
import { extractOrCreateTraceContext, type TraceContext } from "../observability/tracing.js";

declare module "fastify" {
  interface FastifyRequest {
    traceContext?: TraceContext;
  }
}

export function registerTracingMiddleware(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", async (request, reply) => {
    const traceCtx = extractOrCreateTraceContext(request);
    request.traceContext = traceCtx;

    if (traceCtx.traceparent) {
      reply.header("traceparent", traceCtx.traceparent);
    }
  });
}
