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
import { errorHandler } from "./middleware/error.middleware.js";
import { pool } from "./db/connection.js";
import { healthRoutes } from "./routes/health.routes.js";
import { pricesRoutes } from "./routes/prices.routes.js";
import { adminPricesRoutes } from "./routes/admin.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV === "development",
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
      "x-internal-secret",
    ],
    credentials: true,
  });

  // 2. Defensive HTTP Security Headers + WAL LSN emission
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

  // 3. Clerk Authentication Plugin (optional in dev placeholder)
  if (env.CLERK_SECRET_KEY && !env.CLERK_SECRET_KEY.includes("placeholder")) {
    try {
      await app.register(clerkPlugin, {
        publishableKey: env.CLERK_PUBLISHABLE_KEY,
        secretKey: env.CLERK_SECRET_KEY,
      });
    } catch (err) {
      console.warn("[PricingService] Clerk plugin deferred/warning:", err);
    }
  }

  // 4. Global Error Handler
  app.setErrorHandler(errorHandler);

  // 5. Register Routes
  await app.register(healthRoutes);
  await app.register(pricesRoutes, { prefix: "/api/v1/prices" });
  await app.register(adminPricesRoutes, { prefix: "/api/v1/admin" });

  return app;
}
