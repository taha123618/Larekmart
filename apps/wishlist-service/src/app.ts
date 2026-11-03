import Fastify from "fastify";
import type {
  FastifyInstance,
  FastifyError,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import cors from "@fastify/cors";
import { clerkPlugin } from "@clerk/fastify";
import { GATEWAY_HEADERS, resolveCorsOrigins } from "@repo/types";
import { env } from "./config/env.js";
import { pool } from "./db/connection.js";
import { healthRoutes } from "./routes/health.routes.js";
import { wishlistRoutes } from "./routes/wishlist.routes.js";
import { sharedWishlistRoutes } from "./routes/shared-wishlist.routes.js";
import { recordHttpRequest, logger } from "./observability/metrics.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  // 1. CORS Configuration
  const allowedOrigins = resolveCorsOrigins(
    process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS,
  );
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error("CORS origin not allowed"), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-user-id",
      "x-user-role",
      "x-user-name",
      "x-guest-id",
      "x-session-id",
      "x-internal-secret",
    ],
    credentials: true,
  });

  // 2. Defensive HTTP Security Headers & Telemetry Hooks
  app.addHook("onRequest", async (request) => {
    (request as FastifyRequest & { startTime?: bigint }).startTime =
      process.hrtime.bigint();
  });

  app.addHook("onResponse", async (request, reply) => {
    const startTime = (request as FastifyRequest & { startTime?: bigint })
      .startTime;
    if (startTime) {
      const elapsedNs = process.hrtime.bigint() - startTime;
      const elapsedMs = Number(elapsedNs) / 1_000_000;
      recordHttpRequest(
        request.method,
        request.routeOptions?.url || request.url,
        reply.statusCode,
        elapsedMs,
      );
    }
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "1; mode=block");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");

    // Stamp successful mutations with the PostgreSQL WAL high-water mark so the
    // API Gateway can cache a per-session LSN for Read-Your-Writes replica lag
    // detection downstream. WAL is monotonic, so reading it here (after the
    // handler committed) always covers the mutation that was executed.
    if (
      (request.method === "POST" ||
        request.method === "PUT" ||
        request.method === "PATCH" ||
        request.method === "DELETE") &&
      reply.statusCode >= 200 &&
      reply.statusCode < 300
    ) {
      try {
        const { rows } = await pool.query<{ lsn: string }>(
          "SELECT pg_current_wal_lsn()::text AS lsn",
        );
        const lsn = rows[0]?.lsn;
        if (lsn) reply.header(GATEWAY_HEADERS.DB_LSN, lsn);
      } catch {
        // Graceful degradation: the 500ms time-based RYW lease still applies
      }
    }

    return payload;
  });

  // 3. Clerk Authentication Plugin
  if (env.CLERK_SECRET_KEY && !env.CLERK_SECRET_KEY.includes("placeholder")) {
    try {
      await app.register(clerkPlugin, {
        publishableKey: env.CLERK_PUBLISHABLE_KEY,
        secretKey: env.CLERK_SECRET_KEY,
      });
    } catch (err) {
      logger.warn("Clerk plugin deferred/warning:", { err });
    }
  }

  // 4. Global Structured Error Handler (Mandatory { message } JSON)
  app.setErrorHandler(
    (error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = error.statusCode || 500;
      const message = error.message || "Internal server error";

      if (statusCode >= 500) {
        logger.error("[ServerError]", { error });
      }

      reply.status(statusCode).send({ message });
    },
  );

  // 5. Register Routes
  await app.register(healthRoutes);
  await app.register(wishlistRoutes);
  await app.register(sharedWishlistRoutes);

  return app;
}
