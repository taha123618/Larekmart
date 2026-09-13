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
import { prisma } from "@repo/inventory-db";
import inventoryRoute from "./routes/inventory.route.js";
import { logger, metrics } from "./observability/metrics.js";
import { producer } from "./utils/kafka.js";
import { redis } from "./utils/redis.js";

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

const app = new Hono();
app.use("*", clerkMiddleware());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3002", "http://localhost:3003"],
    credentials: true,
  }),
);
app.use("*", async (c, next) => {
  if (c.req.path === "/health" || c.req.path === "/metrics") {
    return next();
  }
  const hook = httpMonitor.onRequestStart({
    method: c.req.method,
    url: c.req.path,
  });
  await next();
  hook.onRequestEnd(c.res.status);
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

async function start(): Promise<void> {
  try {
    await producer.connect();
    serve({ fetch: app.fetch, port }, () => {
      logger.info(`Inventory service is running on port ${port}`);
    });
  } catch (error) {
    logger.fatal("Failed to initialize inventory-service", error);
    process.exit(1);
  }
}

void start();
