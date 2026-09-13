import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { shouldBeUser } from "./middleware/authMiddleware.js";
import productRouter from "./routes/product.route.js";
import categoryRouter from "./routes/category.route.js";
import { consumer, producer } from "./utils/kafka.js";
import { prisma } from "@repo/product-db";
import {
  createHealthRegistry,
  createHttpMonitor,
  createMemoryCheck,
  createDbCheck,
  captureError,
} from "@repo/monitoring";
import { checkOpenSearchConnection } from "./search/client.js";
import { logger, metrics } from "./observability/metrics.js";
import { redis } from "./utils/redis.js";

const httpMonitor = createHttpMonitor(logger, metrics);
const health = createHealthRegistry("product-service", "1.0.0");

// Register health checks
health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});
health.register(
  "postgres",
  createDbCheck("PostgreSQL", () => prisma.$queryRaw`SELECT 1`),
  { critical: true },
);
health.register(
  "opensearch",
  async () => {
    const started = Date.now();
    const healthy = await checkOpenSearchConnection();
    return {
      status: (healthy ? "healthy" : "unhealthy") as "healthy" | "unhealthy",
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
      message: healthy ? "OpenSearch reachable" : "OpenSearch unreachable",
    };
  },
  { critical: false },
);
// Redis only backs the catalog cache, so losing it degrades performance but
// must never flip the service to unhealthy.
health.register(
  "redis",
  createDbCheck("Redis", async () => {
    if (!(await redis.ping())) {
      throw new Error("PING did not return PONG");
    }
  }),
  { critical: false },
);

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3002", "http://localhost:3003"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(clerkMiddleware());

// HTTP Request Monitoring Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/health" || req.path === "/metrics") {
    return next();
  }
  const hook = httpMonitor.onRequestStart({
    method: req.method,
    url: req.path,
  });
  res.on("finish", () => {
    hook.onRequestEnd(res.statusCode);
  });
  next();
});

// Health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  const report = await health.runChecks();
  const statusCode = report.status === "unhealthy" ? 503 : 200;
  return res.status(statusCode).json(report);
});

// Prometheus Metrics endpoint
app.get("/metrics", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  return res.send(metrics.toPrometheus());
});

app.get("/test", shouldBeUser, (req, res) => {
  res.json({ message: "Product service authenticated", userId: req.userId });
});

app.use("/products", productRouter);
app.use("/categories", categoryRouter);

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const formatted = captureError(err, {
    serviceName: "product-service",
    logger,
    route: req.url,
  });
  return res
    .status(formatted.statusCode || 500)
    .json({ message: formatted.message || "Internal Server Error!" });
});

const start = async () => {
  try {
    await Promise.all([producer.connect(), consumer.connect()]);
    app.listen(8000, () => {
      logger.info("Product service is running on port 8000");
    });
  } catch (error) {
    logger.fatal("Failed to initialize product-service", error);
    process.exit(1);
  }
};

start();
