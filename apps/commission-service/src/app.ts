import Fastify from "fastify";
import cors from "@fastify/cors";
import { resolveCorsOrigins } from "@repo/types";
import { internalCommissionRoutes } from "./routes/internal.routes.js";
import { adminCommissionRoutes } from "./routes/admin.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { env } from "./config/env.js";

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  app.setErrorHandler(errorHandler);

  // 1. Strict CORS origin validation
  const allowedOrigins = resolveCorsOrigins(
    process.env.CORS_ORIGIN || `${env.CLIENT_URL},${env.ADMIN_URL}`,
  );
  app.register(cors, {
    origin: (origin, cb) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        env.NODE_ENV !== "production"
      ) {
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
      "x-internal-secret",
    ],
    credentials: true,
  });

  // 2. Defensive HTTP Security Headers
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "1; mode=block");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    return payload;
  });

  // Health and metrics
  app.register(healthRoutes);

  // Business domain routes
  app.register(internalCommissionRoutes, {
    prefix: "/api/v1/internal/commissions",
  });
  app.register(adminCommissionRoutes, { prefix: "/api/v1/admin/commissions" });

  return app;
}
