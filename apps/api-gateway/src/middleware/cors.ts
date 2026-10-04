import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "../config/env.js";

export async function registerCorsMiddleware(
  fastify: FastifyInstance,
): Promise<void> {
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }

      cb(new Error("CORS origin not allowed"), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "X-Request-ID",
      "x-guest-token",
      "X-Guest-Token",
      "x-user-id",
      "X-User-ID",
      "Idempotency-Key",
      "idempotency-key",
      "traceparent",
      "baggage",
    ],
    exposedHeaders: [
      "x-request-id",
      "x-guest-token",
      "Content-Range",
      "X-Total-Count",
    ],
    credentials: true,
  });
}
