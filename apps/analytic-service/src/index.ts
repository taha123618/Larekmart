import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { createConsumer, createKafkaClient } from "@repo/kafka";
import { initAnalyticsDB, pool } from "./db.js";
import analyticsRouter from "./routes/analytics.route.js";
import {
  recordPayment,
  recordOrder,
  recordUserSignup,
  recordProductCreated,
  recordProductDeleted,
  getMetricsSnapshot,
} from "./services/metrics.service.js";
import type {
  PaymentSuccessfulType,
  OrderCreatedType,
  UserCreatedType,
  StripeProductType,
} from "@repo/types";
import {
  createHealthRegistry,
  createHttpMonitor,
  createMemoryCheck,
  createDbCheck,
  captureError,
} from "@repo/monitoring";
import { logger, metrics } from "./observability/metrics.js";
import { redis } from "./utils/redis.js";

const httpMonitor = createHttpMonitor(logger, metrics);
const health = createHealthRegistry("analytic-service", "1.0.0");

health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});
health.register(
  "postgres",
  createDbCheck("PostgreSQL", async () => {
    await pool.query("SELECT 1");
  }),
  { critical: true },
);
// Redis is a cache only: losing it degrades /analytics reads to PostgreSQL,
// so it must never flip the service to unhealthy.
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
const PORT = process.env.PORT || 8004;

// Middleware
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

// Health check
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

// Mount analytics routes
app.use("/analytics", analyticsRouter);

// Global error handler
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const formatted = captureError(err, {
    serviceName: "analytic-service",
    logger,
    route: req.url,
  });
  return res
    .status(formatted.statusCode || 500)
    .json({ message: formatted.message || "Internal Server Error" });
});

// Kafka client & consumer setup
const kafka = createKafkaClient("analytic-service");
const consumer = createConsumer(kafka, "analytic-service-group");

const start = async () => {
  try {
    console.log("Starting Analytic Service...");

    // 1. Initialize DB tables if PostgreSQL is available
    await initAnalyticsDB();

    // 2. Connect Kafka consumer
    await consumer.connect();

    // 3. Register subscriptions for all project event streams
    await consumer.subscribe([
      {
        topicName: "payment.successful",
        topicHandler: async (message: any) => {
          const payload: PaymentSuccessfulType = message.value || message;
          if (payload) {
            await recordPayment(payload);
          }
        },
      },
      {
        topicName: "payment-successful",
        topicHandler: async (message: any) => {
          const payload: PaymentSuccessfulType = message.value || message;
          if (payload) {
            await recordPayment(payload);
          }
        },
      },
      {
        topicName: "order.created",
        topicHandler: async (message: any) => {
          const payload: OrderCreatedType = message.value || message;
          if (payload) {
            await recordOrder(payload);
          }
        },
      },
      {
        topicName: "order-successful",
        topicHandler: async (message: any) => {
          const payload: OrderCreatedType = message.value || message;
          if (payload) {
            await recordOrder(payload);
          }
        },
      },
      {
        topicName: "user.created",
        topicHandler: async (message: any) => {
          const payload: UserCreatedType = message.value || message;
          if (payload) {
            await recordUserSignup(payload);
          }
        },
      },
      {
        topicName: "email-successful",
        topicHandler: async (message: any) => {
          const payload: UserCreatedType = message.value || message;
          if (payload) {
            await recordUserSignup(payload);
          }
        },
      },
      {
        topicName: "product.created",
        topicHandler: async (message: any) => {
          const payload: StripeProductType = message.value || message;
          if (payload) {
            await recordProductCreated(payload);
          }
        },
      },
      {
        topicName: "product.deleted",
        topicHandler: async (message: any) => {
          const payload = message.value !== undefined ? message.value : message;
          if (payload !== undefined) {
            await recordProductDeleted(payload);
          }
        },
      },
    ]);

    // 4. Start HTTP Server
    app.listen(PORT, () => {
      logger.info(`Analytic Service HTTP API is running on port ${PORT}`);
    });

    logger.info(
      "Analytic Service is running and actively listening to Kafka event streams.",
    );

    // Periodic heartbeat log of accumulated metrics
    setInterval(() => {
      const snapshot = getMetricsSnapshot();
      logger.info(
        `[Analytics Heartbeat] Revenue: $${snapshot.totalRevenue.toFixed(2)} | Orders: ${snapshot.totalOrders} | Signups: ${snapshot.totalSignups} | Products: +${snapshot.totalProductsCreated}/-${snapshot.totalProductsDeleted}`,
      );
    }, 60000);
  } catch (error) {
    logger.fatal(
      "Analytic Service encountered a critical startup error",
      error,
    );
  }
};

start();
