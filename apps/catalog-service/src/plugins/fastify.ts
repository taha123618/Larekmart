import type { FastifyError, FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { GATEWAY_HEADERS } from "@repo/types";
import { isReadYourWritesActive } from "@repo/redis";
import { logger } from "../observability/metrics.js";
import { redis } from "../utils/redis.js";
import { databaseContext } from "../utils/database-context.js";

declare module "fastify" {
  interface FastifyRequest {
    forcePrimary?: boolean;
  }
}

export async function configureFastifyPlugins(
  fastify: FastifyInstance,
): Promise<void> {
  // Decorate Fastify request with default forcePrimary flag
  fastify.decorateRequest("forcePrimary", false);

  // CORS with allowed origins
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
      GATEWAY_HEADERS.FORCE_PRIMARY,
      GATEWAY_HEADERS.READ_YOUR_WRITES,
      GATEWAY_HEADERS.USER_ID,
      GATEWAY_HEADERS.CLIENT_SESSION_ID,
      GATEWAY_HEADERS.GUEST_TOKEN,
      "x-force-primary",
      "x-read-your-writes",
      "x-user-id",
      "x-session-id",
      "x-guest-token",
    ],
  });

  // Read-Your-Writes consistency hook: inspect gateway header or active Redis lease
  fastify.addHook("onRequest", async (request) => {
    const forcePrimaryHeader =
      request.headers[GATEWAY_HEADERS.FORCE_PRIMARY] === "true" ||
      request.headers["x-force-primary"] === "true";

    let forcePrimary = forcePrimaryHeader;

    if (!forcePrimary) {
      const rywClientId =
        (request.headers[GATEWAY_HEADERS.USER_ID] as string) ||
        (request.headers[GATEWAY_HEADERS.CLIENT_SESSION_ID] as string) ||
        (request.headers[GATEWAY_HEADERS.GUEST_TOKEN] as string) ||
        (request.headers["x-user-id"] as string) ||
        (request.headers["x-session-id"] as string) ||
        (request.headers["x-guest-token"] as string) ||
        request.ip;

      if (rywClientId) {
        try {
          forcePrimary = await isReadYourWritesActive(
            redis.client,
            rywClientId,
          );
        } catch {
          // Graceful non-blocking degradation
        }
      }
    }

    request.forcePrimary = forcePrimary;
  });

  // Pre-handler hook to establish ambient database context for synchronous and async execution
  fastify.addHook("preHandler", (request, _reply, done) => {
    databaseContext.enterWith({
      forcePrimary: Boolean(request.forcePrimary),
    });
    done();
  });

  // Defensive HTTP Security Headers and consistency plane telemetry
  fastify.addHook("onSend", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");

    if (request.forcePrimary) {
      reply.header("X-Consistency-Plane", "primary-master");
    }
  });

  // Global Error Handler
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    logger.error("Fastify request error", {
      path: request.url,
      method: request.method,
      error: error.message,
      stack: error.stack,
    });

    const statusCode = error.statusCode || 500;
    const isProd = process.env.NODE_ENV === "production";
    const safeMessage =
      statusCode >= 500 && isProd
        ? "Internal Server Error"
        : error.message || "Internal server error";

    return reply.status(statusCode).send({
      message: safeMessage,
      statusCode,
    });
  });
}
