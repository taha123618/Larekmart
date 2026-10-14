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
  recordInventoryEvent,
  recordCartEvent,
  recordMediaEvent,
  recordReviewEvent,
  recordWishlistEvent,
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
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3002",
  process.env.ADMIN_URL || "http://localhost:3003",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
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
const kafkaBrokers = (
  process.env.KAFKA_BROKERS || "localhost:9094,localhost:9095,localhost:9096"
)
  .split(",")
  .map((b) => b.trim());
const kafka = createKafkaClient("analytic-service", kafkaBrokers);
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
        topicName: "user.registered",
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
      {
        topicName: "inventory.stock.sold",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordInventoryEvent("inventory.stock.sold", payload);
          }
        },
      },
      {
        topicName: "inventory.low_stock",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordInventoryEvent("inventory.low_stock", payload);
          }
        },
      },
      {
        topicName: "inventory.restocked",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordInventoryEvent("inventory.restocked", payload);
          }
        },
      },
      {
        topicName: "cart.created",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordCartEvent("cart.created", payload);
          }
        },
      },
      {
        topicName: "cart.updated",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordCartEvent("cart.updated", payload);
          }
        },
      },
      {
        topicName: "cart.merged",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordCartEvent("cart.merged", payload);
          }
        },
      },
      {
        topicName: "cart.expired",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordCartEvent("cart.expired", payload);
          }
        },
      },
      {
        topicName: "cart.cleared",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordCartEvent("cart.cleared", payload);
          }
        },
      },
      {
        topicName: "media.uploaded",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordMediaEvent("media.uploaded", payload);
          }
        },
      },
      {
        topicName: "media.processing_completed",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordMediaEvent("media.processing_completed", payload);
          }
        },
      },
      {
        topicName: "media.processing_failed",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordMediaEvent("media.processing_failed", payload);
          }
        },
      },
      {
        topicName: "media.deleted",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordMediaEvent("media.deleted", payload);
          }
        },
      },
      {
        topicName: "media.quarantined",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordMediaEvent("media.quarantined", payload);
          }
        },
      },
      {
        topicName: "review.created",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordReviewEvent("review.created", payload);
          }
        },
      },
      {
        topicName: "review.approved",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordReviewEvent("review.approved", payload);
          }
        },
      },
      {
        topicName: "review.reported",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordReviewEvent("review.reported", payload);
          }
        },
      },
      {
        topicName: "product.rating-summary.updated",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordReviewEvent("product.rating-summary.updated", payload);
          }
        },
      },
      {
        topicName: "wishlist.created",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordWishlistEvent("wishlist.created", payload);
          }
        },
      },
      {
        topicName: "wishlist.item.added",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordWishlistEvent("wishlist.item.added", payload);
          }
        },
      },
      {
        topicName: "wishlist.item.removed",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordWishlistEvent("wishlist.item.removed", payload);
          }
        },
      },
      {
        topicName: "wishlist.merged",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordWishlistEvent("wishlist.merged", payload);
          }
        },
      },
      {
        topicName: "wishlist.price-drop.alert",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordWishlistEvent("wishlist.price-drop.alert", payload);
          }
        },
      },
      {
        topicName: "wishlist.restock.alert",
        topicHandler: async (message: any) => {
          const payload = message.value || message;
          if (payload) {
            await recordWishlistEvent("wishlist.restock.alert", payload);
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
    process.exit(1);
  }
};

start();
