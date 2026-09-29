import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { clerkPlugin, getAuth } from "@clerk/fastify";
import { globalErrorHandler } from "../middleware/error-handler.js";
import { logger, metrics, userMetrics } from "../observability/metrics.js";
import { createHttpMonitor } from "@repo/monitoring";
import { config } from "../config/env.js";

export async function configureFastifyPlugins(
  fastify: FastifyInstance,
): Promise<void> {
  // 1. CORS
  await fastify.register(cors, {
    origin: config.allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "X-Request-ID",
      "x-user-id",
      "X-User-ID",
      "x-internal-secret",
    ],
    credentials: true,
  });

  // 2. Defensive HTTP Security Headers
  fastify.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "1; mode=block");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  });

  // 3. Clerk Authentication plugin
  await fastify.register(clerkPlugin, {
    publishableKey: config.clerkPublishableKey,
    secretKey: config.clerkSecretKey,
  });

  // 3. HTTP Monitoring Hooks
  const httpMonitor = createHttpMonitor(logger, metrics);
  const requestHooks = new Map<
    string,
    {
      onRequestEnd: (
        status: number,
        extraMeta?: Record<string, unknown>,
      ) => void;
    }
  >();

  fastify.addHook("onRequest", async (request) => {
    if (
      request.url === "/health" ||
      request.url === "/ready" ||
      request.url === "/metrics"
    ) {
      return;
    }

    const requestId =
      (request.headers["x-request-id"] as string) ||
      (request.headers["x-correlation-id"] as string) ||
      (request.id ? String(request.id) : undefined);

    let authUserId: string | undefined = undefined;
    try {
      const auth = getAuth(request);
      if (auth?.userId) {
        authUserId = auth.userId;
      }
    } catch {
      // Optional or unauthenticated endpoint
    }

    const hook = httpMonitor.onRequestStart({
      method: request.method,
      url: request.url,
      requestId: requestId || `req-${request.id}`,
      userId: authUserId || "guest",
    });
    requestHooks.set(request.id, hook);
  });

  fastify.addHook("onResponse", async (request, reply) => {
    userMetrics.requestsTotal.inc({
      method: request.method,
      route: request.routeOptions.url || request.url,
      status: String(reply.statusCode),
    });

    const hook = requestHooks.get(request.id);
    if (hook) {
      let authUserId: string | undefined = undefined;
      try {
        const auth = getAuth(request);
        if (auth?.userId) {
          authUserId = auth.userId;
        }
      } catch {
        // ignore
      }

      const requestId =
        (request.headers["x-request-id"] as string) ||
        (request.id ? String(request.id) : undefined);

      hook.onRequestEnd(reply.statusCode, {
        requestId: requestId || `req-${request.id}`,
        userId: authUserId || "guest",
      });
      requestHooks.delete(request.id);
    }
  });

  // 4. Global Error Handler
  fastify.setErrorHandler(globalErrorHandler);
}
