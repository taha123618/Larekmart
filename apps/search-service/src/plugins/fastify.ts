import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import Clerk from "@clerk/fastify";
import { globalErrorHandler } from "../middleware/error-handler.js";
import { logger, metrics } from "../observability/metrics.js";
import { createHttpMonitor } from "@repo/monitoring";

export async function configureFastifyPlugins(
  fastify: FastifyInstance,
): Promise<void> {
  // 1. CORS
  await fastify.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // 2. Clerk Authentication plugin
  await fastify.register(Clerk.clerkPlugin);

  // 3. HTTP Monitoring Hooks
  const httpMonitor = createHttpMonitor(logger, metrics);
  const requestHooks = new Map<
    string,
    { onRequestEnd: (status: number) => void }
  >();

  fastify.addHook("onRequest", async (request) => {
    if (
      request.url === "/health" ||
      request.url === "/ready" ||
      request.url === "/metrics"
    ) {
      return;
    }
    const hook = httpMonitor.onRequestStart({
      method: request.method,
      url: request.url,
    });
    requestHooks.set(request.id, hook);
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const hook = requestHooks.get(request.id);
    if (hook) {
      hook.onRequestEnd(reply.statusCode);
      requestHooks.delete(request.id);
    }
  });

  // 4. Global Error Handler
  fastify.setErrorHandler(globalErrorHandler);
}
