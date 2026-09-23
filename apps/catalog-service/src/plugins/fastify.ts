import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { logger } from "../observability/metrics.js";

export async function configureFastifyPlugins(
  fastify: FastifyInstance,
): Promise<void> {
  // CORS
  await fastify.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Global Error Handler
  fastify.setErrorHandler((error, request, reply) => {
    logger.error("Fastify request error", {
      path: request.url,
      method: request.method,
      error: error.message,
      stack: error.stack,
    });

    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      message: error.message || "Internal server error",
      statusCode,
    });
  });
}
