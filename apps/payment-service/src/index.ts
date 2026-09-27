import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { clerkMiddleware } from "@hono/clerk-auth";
import sessionRoute from "./routes/session.route.js";
import { cors } from "hono/cors";
import { consumer, producer } from "./utils/kafka.js";
import { runKafkaSubscriptions } from "./utils/subscriptions.js";
import webhookRoute from "./routes/webhooks.route.js";
import {
  createLogger,
  createHealthRegistry,
  createMetricsRegistry,
  createHttpMonitor,
  createMemoryCheck,
} from "@repo/monitoring";

const logger = createLogger("payment-service");
const metrics = createMetricsRegistry("payment-service");
const httpMonitor = createHttpMonitor(logger, metrics);
const health = createHealthRegistry("payment-service", "1.0.0");

health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});

const allowedOrigins = [process.env.CLIENT_URL || "http://localhost:3002"];

const app = new Hono();
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return origin || allowedOrigins[0] || "http://localhost:3002";
      }
      return null;
    },
    credentials: true,
  }),
);
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
});
app.use("*", clerkMiddleware());

// HTTP Request Monitoring Middleware
app.use("*", async (c, next) => {
  if (c.req.path === "/health" || c.req.path === "/metrics") {
    return await next();
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
  const statusCode = report.status === "unhealthy" ? 503 : 200;
  return c.json(report, statusCode);
});

app.get("/metrics", (c) => {
  return c.text(metrics.toPrometheus(), 200, {
    "Content-Type": "text/plain; version=0.0.4",
  });
});

app.route("/sessions", sessionRoute);
app.route("/webhooks", webhookRoute);

const start = async () => {
  try {
    await Promise.all([producer.connect(), consumer.connect()]);
    await runKafkaSubscriptions();
    serve(
      {
        fetch: app.fetch,
        port: 8002,
      },
      () => {
        logger.info("Payment service is running on port 8002");
      },
    );
  } catch (error) {
    logger.fatal("Failed to initialize payment-service", error);
    process.exit(1);
  }
};
start();
