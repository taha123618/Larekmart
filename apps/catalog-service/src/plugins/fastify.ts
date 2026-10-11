import type { FastifyError, FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { logger } from "../observability/metrics.js";

export async function configureFastifyPlugins(
  fastify: FastifyInstance,
): Promise<void> {
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
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Defensive HTTP Security Headers
  fastify.addHook("onSend", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
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
