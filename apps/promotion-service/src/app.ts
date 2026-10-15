import { Hono } from "hono";
import { cors } from "hono/cors";
import { clerkMiddleware } from "@hono/clerk-auth";
import {
  captureError,
  createDbCheck,
  createHealthRegistry,
  createHttpMonitor,
  createMemoryCheck,
} from "@repo/monitoring";
import { pool } from "./db/connection.js";
import { redis } from "./utils/redis.js";
import { promotionRoutes } from "./routes/promotion.routes.js";
import { logger, metrics } from "./observability/metrics.js";
import { env } from "./config/env.js";

export const health = createHealthRegistry("promotion-service", "1.0.0");
const httpMonitor = createHttpMonitor(logger, metrics);

health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});

health.register(
  "postgres",
  createDbCheck("PostgreSQL", async () => {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
  }),
  { critical: true },
);

health.register(
  "redis",
  createDbCheck("Redis", async () => {
    if (!(await redis.ping())) throw new Error("PING did not return PONG");
  }),
  { critical: false },
);

const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3002",
  process.env.ADMIN_URL || "http://localhost:3003",
];

export const app = new Hono();

// 1. CORS
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
      "x-guest-id",
      "x-guest-session-id",
      "x-correlation-id",
      "x-internal-secret",
    ],
    credentials: true,
  }),
);

// 2. Defensive HTTP Security Headers
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
});

// 3. Clerk Auth Middleware
app.use(
  "*",
  clerkMiddleware({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  }),
);

// 4. HTTP Monitoring hooks
app.use("*", async (c, next) => {
  if (
    c.req.path === "/health" ||
    c.req.path === "/metrics" ||
    c.req.path === "/ready"
  ) {
    return next();
  }
  const requestId =
    c.req.header("x-request-id") ||
    c.req.header("x-correlation-id") ||
    `req-${Date.now()}`;

  const userId = c.req.header("x-user-id");

  const hook = httpMonitor.onRequestStart({
    method: c.req.method,
    url: c.req.path,
    requestId,
    userId: userId || "guest",
  });
  await next();
  hook.onRequestEnd(c.res.status, {
    requestId,
    userId: userId || (c.get as any)("userId") || "guest",
  });
});

// 5. Health & Observability Endpoints
app.get("/health", async (c) => {
  const report = await health.runChecks();
  return c.json(report, report.status === "unhealthy" ? 503 : 200);
});

app.get("/ready", async (c) => {
  try {
    const client = await pool.connect();
    client.release();
    return c.json({ status: "ready", postgres: true }, 200);
  } catch {
    return c.json({ status: "not_ready", postgres: false }, 503);
  }
});

app.get("/metrics", (c) =>
  c.text(metrics.toPrometheus(), 200, {
    "Content-Type": "text/plain; version=0.0.4",
  }),
);

// 6. Mount Promotion Routes
app.route("/api/v1", promotionRoutes);

// 7. Error Handling
app.onError((error, c) => {
  const formatted = captureError(error, {
    serviceName: "promotion-service",
    logger,
    route: c.req.path,
  });
  return c.json(
    { message: formatted.message || "Internal Server Error" },
    (formatted.statusCode || 500) as 400 | 401 | 403 | 404 | 500,
  );
});
