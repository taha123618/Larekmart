import { Hono } from "hono";
import { cors } from "hono/cors";
import { clerkMiddleware } from "@hono/clerk-auth";
import { env } from "./config/env.js";
import { shouldBeUser } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestContextMiddleware } from "./middleware/request-context.js";
import { metrics } from "./observability/metrics.js";
import { closeDb } from "./db/client.js";
import { logger } from "./observability/metrics.js";
import healthRoute from "./routes/health.js";
import mediaRoute from "./routes/media.js";
import uploadsRoute from "./routes/uploads.js";
import adminRoute from "./routes/admin.js";

/**
 * Media-service HTTP app (Hono). Route handlers stay thin: storage,
 * processing, and metadata logic live in services/repositories.
 */
export function createApp(): Hono {
  const app = new Hono();

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

  // Clerk session authentication when key is present
  if (process.env.CLERK_SECRET_KEY) {
    app.use(
      "*",
      clerkMiddleware({
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
        secretKey: process.env.CLERK_SECRET_KEY,
      }),
    );
  }

  app.onError(errorHandler);

  // ---- Health endpoints (spec section 58) ----
  app.route("/health", healthRoute);
  app.get("/healthz", (c) => c.json({ status: "alive" }));

  // Prometheus Metrics endpoint
  app.get("/metrics", (c) =>
    c.text(metrics.toPrometheus(), 200, {
      "Content-Type": "text/plain; version=0.0.4",
    }),
  );

  // Authenticated identity probe used by tests and other services.
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

/** Graceful shutdown helper shared by server and workers. */
export async function shutdown(): Promise<void> {
  try {
    await closeDb();
  } catch (error) {
    logger.error("Error closing PostgreSQL pool", error);
  }
}

export { env };
