import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { clerkPlugin, getAuth } from "@clerk/fastify";
import { globalErrorHandler } from "../middleware/error-handler.js";
import { logger, metrics } from "../observability/metrics.js";
import { createHttpMonitor } from "@repo/monitoring";

export async function configureFastifyPlugins(
  fastify: FastifyInstance,
): Promise<void> {
  // 1. CORS with strict allowed origins
  const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:3002",
    process.env.ADMIN_URL || "http://localhost:3003",
  ];

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "X-Request-ID",
      "x-user-id",
      "X-User-ID",
      "x-correlation-id",
    ],
  });

  // 2. Defensive HTTP Security Headers
  fastify.addHook("onSend", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  });

  // 3. Clerk Authentication plugin
  await fastify.register(clerkPlugin);

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

    let userId = (request.headers["x-user-id"] as string) || undefined;
    if (!userId) {
      try {
        const auth = getAuth(request);
        if (auth?.userId) {
          userId = auth.userId;
        }
      } catch {
        // Optional auth on public search endpoints
      }
    }

    const hook = httpMonitor.onRequestStart({
      method: request.method,
      url: request.url,
      requestId: requestId || `req-${request.id}`,
      userId: userId || "guest",
    });
    requestHooks.set(request.id, hook);
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const hook = requestHooks.get(request.id);
    if (hook) {
      let userId =
        request.userId || (request.headers["x-user-id"] as string) || undefined;
      if (!userId) {
        try {
          const auth = getAuth(request);
          if (auth?.userId) {
            userId = auth.userId;
          }
        } catch {
          // ignore
        }
      }

      const requestId =
        (request.headers["x-request-id"] as string) ||
        (request.id ? String(request.id) : undefined);

      hook.onRequestEnd(reply.statusCode, {
        requestId: requestId || `req-${request.id}`,
        userId: userId || "guest",
      });
      requestHooks.delete(request.id);
    }
  });

  // 4. Global Error Handler
  fastify.setErrorHandler(globalErrorHandler);
}
