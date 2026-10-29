import { serve } from "@hono/node-server";
import { clerkMiddleware } from "@hono/clerk-auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  captureError,
  createDbCheck,
  createHealthRegistry,
  createHttpMonitor,
  createMemoryCheck,
} from "@repo/monitoring";
import { prisma, disconnectPrisma } from "@repo/inventory-db";
import { validateInternalServiceSecret } from "@repo/types";
import inventoryRoute from "./routes/inventory.route.js";
import { logger, metrics } from "./observability/metrics.js";
import { consumer, producer } from "./utils/kafka.js";
import { redis } from "./utils/redis.js";
import { startReservationExpiryWorker } from "./workers/reservation-expiry.worker.js";
import { startInventoryEventConsumer } from "./workers/inventory-event.consumer.js";

const port = Number.parseInt(process.env.PORT ?? "8007", 10);
const health = createHealthRegistry("inventory-service", "1.0.0");
const httpMonitor = createHttpMonitor(logger, metrics);

health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});
health.register(
  "postgres",
  createDbCheck("PostgreSQL", () => prisma.$queryRaw`SELECT 1`),
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

const app = new Hono();

// 1. CORS must run first so preflight OPTIONS requests succeed immediately
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
      "x-correlation-id",
    ],
    credentials: true,
  }),
);

// Defensive HTTP Security Headers
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
});

// 2. Clerk middleware with environment keys
app.use(
  "*",
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }),
);

// 3. HTTP Monitoring hooks with requestId and userId
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

  let userId = c.req.header("x-user-id");

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

app.get("/health", async (c) => {
  const report = await health.runChecks();
  return c.json(report, report.status === "unhealthy" ? 503 : 200);
});

app.get("/ready", async (c) => {
  const postgres = await prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );
  return c.json(
    { status: postgres ? "ready" : "not_ready", postgres },
    postgres ? 200 : 503,
  );
});

app.get("/metrics", (c) =>
  c.text(metrics.toPrometheus(), 200, {
    "Content-Type": "text/plain; version=0.0.4",
  }),
);

app.route("/api/v1/inventory", inventoryRoute);

app.onError((error, c) => {
  const formatted = captureError(error, {
    serviceName: "inventory-service",
    logger,
    route: c.req.path,
  });
  return c.json(
    { message: formatted.message || "Internal Server Error" },
    (formatted.statusCode || 500) as 400 | 401 | 403 | 404 | 500,
  );
});

let stopExpiryWorker: (() => void) | null = null;

async function start(): Promise<void> {
  try {
    validateInternalServiceSecret(
      process.env.INTERNAL_SERVICE_SECRET,
      process.env.NODE_ENV,
      "inventory-service",
    );
    await producer.connect();
    await consumer.connect();
    await startInventoryEventConsumer();
    stopExpiryWorker = startReservationExpiryWorker();

    serve({ fetch: app.fetch, port }, () => {
      logger.info(`Inventory service is running on port ${port}`);
    });
  } catch (error) {
    logger.fatal("Failed to initialize inventory-service", error);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  if (stopExpiryWorker) {
    stopExpiryWorker();
  }
  try {
    await consumer.disconnect();
  } catch (err) {
    logger.error("Error disconnecting Kafka consumer", err);
  }
  try {
    await producer.disconnect();
  } catch (err) {
    logger.error("Error disconnecting Kafka producer", err);
  }
  try {
    await redis.close();
  } catch (err) {
    logger.error("Error closing Redis connection", err);
  }
  try {
    await disconnectPrisma();
  } catch (err) {
    logger.error("Error disconnecting Prisma", err);
  }
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void start();
