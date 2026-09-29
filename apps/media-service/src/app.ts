import { Hono } from "hono";
import { cors } from "hono/cors";
import { createHealthRegistry, createMemoryCheck } from "@repo/monitoring";
import { env } from "./config/env.js";
import { getServiceContainer } from "./container.js";
import { shouldBeUser } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestContextMiddleware } from "./observability/tracing.js";
import { logger, metrics } from "./observability/metrics.js";
import { redis } from "./utils/redis.js";
import { closeDb } from "./db/client.js";
import mediaRoute from "./routes/media.js";
import uploadsRoute from "./routes/uploads.js";
import adminRoute from "./routes/admin.js";

/**
 * Media-service HTTP app (Hono). Route handlers stay thin: storage,
 * processing, and metadata logic live in services/repositories.
 */
export function createApp(): Hono {
  const app = new Hono();
  const health = createHealthRegistry("media-service", "1.0.0");
  const { storage } = getServiceContainer();

  health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
    critical: false,
  });

  // CORS matching the other Hono services in the monorepo.
  const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:3002",
    process.env.ADMIN_URL || "http://localhost:3003",
  ];
  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return origin || allowedOrigins[0] || "http://localhost:3002";
        }
        return null;
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-request-id",
        "X-Request-ID",
        "x-user-id",
        "X-User-ID",
        "Idempotency-Key",
      ],
      credentials: true,
    }),
  );

  // Security headers.
  app.use("*", async (c, next) => {
    await next();
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    c.res.headers.set("X-Frame-Options", "DENY");
    c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  });

  // Request/trace context propagation.
  app.use("*", requestContextMiddleware);

  app.onError(errorHandler);

  // ---- Health endpoints (spec section 58) ----
  app.get("/health", async (c) => {
    const report = await health.runChecks();
    return c.json(report, report.status === "unhealthy" ? 503 : 200);
  });

  // Liveness: process alive, no external dependencies.
  app.get("/health/live", (c) => c.json({ status: "alive" }));
  app.get("/healthz", (c) => c.json({ status: "alive" }));

  // Readiness: PostgreSQL + Redis + storage (Kafka degrades, not blocks).
  app.get("/health/ready", async (c) => {
    const checks: Record<string, boolean> = {};

    checks.postgres = await db_probe();
    checks.redis = await redis.ping().catch(() => false);
    checks.storage = await storage.checkConnectivity();

    const ready = Object.values(checks).every(Boolean);
    return c.json(
      { status: ready ? "ready" : "not_ready", checks },
      ready ? 200 : 503,
    );
  });

  app.get("/metrics", (c) =>
    c.text(metrics.toPrometheus(), 200, {
      "Content-Type": "text/plain; version=0.0.4",
    }),
  );

  // A simple authenticated identity probe used by tests and other services.
  app.get("/whoami", shouldBeUser, (c) => {
    return c.json({
      userId: c.get("userId"),
      role: c.get("mediaActor")?.role ?? "user",
    });
  });

  // ---- Domain routes (spec section 26) ----
  app.route("/api/v1/media", mediaRoute);
  app.route("/api/v1/media", uploadsRoute);
  app.route("/api/v1/admin", adminRoute);

  return app;
}

async function db_probe(): Promise<boolean> {
  try {
    const { sql } = await import("drizzle-orm");
    const { db } = await import("./db/client.js");
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    logger.warn(`PostgreSQL readiness probe failed: ${String(error)}`);
    return false;
  }
}

/** Graceful shutdown helper shared by server and workers. */
export async function shutdown(): Promise<void> {
  try {
    await closeDb();
  } catch (error) {
    logger.error("Error closing PostgreSQL pool", error);
  }
}

export { env };
