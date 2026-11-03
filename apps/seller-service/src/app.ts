import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { GATEWAY_HEADERS, resolveCorsOrigins } from "@repo/types";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { pool } from "./db/connection.js";
import { healthRoutes } from "./routes/health.routes.js";
import { storefrontRoutes } from "./routes/storefront.routes.js";
import { sellerRoutes } from "./routes/seller.routes.js";
import { adminSellerRoutes } from "./routes/admin.routes.js";

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
      "x-user-is-super-admin",
      "x-user-is-seller",
      "x-user-can-manage-sellers",
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

  // 3. Global Error Handler
  app.setErrorHandler(errorHandler);

  // 4. Register Routes
  await app.register(healthRoutes);
  await app.register(storefrontRoutes);
  await app.register(sellerRoutes);
  await app.register(adminSellerRoutes);

  return app;
}
