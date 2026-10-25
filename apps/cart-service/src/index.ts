import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { createHttpMonitor, captureError } from "@repo/monitoring";
import { connectCartDB, closeCartDB } from "@repo/cart-db";
import { env } from "./config/env.js";
import { logger, metrics } from "./observability/metrics.js";
import { redis } from "./utils/redis.js";
import { producer, consumer } from "./utils/kafka.js";
import { connectKafka, disconnectKafka } from "./publishers/cart.publisher.js";
import {
  handleProductUpdated,
  handleProductDeleted,
  handlePriceUpdated,
} from "./consumers/product.consumer.js";
import { handleInventoryAdjusted } from "./consumers/inventory.consumer.js";
import {
  handleOrderCreated,
  handleUserDeleted,
} from "./consumers/order.consumer.js";
import {
  startCartExpirationWorker,
  stopCartExpirationWorker,
} from "./workers/cart-expiration.worker.js";
import healthRouter from "./routes/health.routes.js";
import cartRouter from "./routes/cart.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

const httpMonitor = createHttpMonitor(logger, metrics);
export const app: Express = express();

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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-guest-token",
      "x-user-id",
      "x-request-id",
    ],
    exposedHeaders: ["x-guest-token"],
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

// Health and Metrics Routes
app.use(healthRouter);

// Cart API Routes
app.use("/api/v1/cart", cartRouter);

// Error Handling
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const formatted = captureError(err, {
    serviceName: "cart-service",
    logger,
    route: req.url,
  });
  if (res.headersSent) {
    return next(err);
  }
  errorHandler(err, req, res, next);
});

export const startServer = async (): Promise<void> => {
  try {
    // 1. Connect MongoDB
    await connectCartDB(env.MONGO_URL);

    // 2. Connect Kafka and subscribe handlers
    await connectKafka();
    try {
      await consumer.connect();
      await consumer.subscribe([
        {
          topicName: "product.updated",
          topicHandler: async (msg) => {
            if (msg.value) await handleProductUpdated(msg.value);
          },
        },
        {
          topicName: "pricing.price.updated",
          topicHandler: async (msg) => {
            if (msg.value) await handlePriceUpdated(msg.value);
          },
        },
        {
          topicName: "product.deleted",
          topicHandler: async (msg) => {
            if (msg.value) await handleProductDeleted(msg.value);
          },
        },
        {
          topicName: "inventory.adjusted",
          topicHandler: async (msg) => {
            if (msg.value) await handleInventoryAdjusted(msg.value);
          },
        },
        {
          topicName: "order.created",
          topicHandler: async (msg) => {
            if (msg.value) await handleOrderCreated(msg.value);
          },
        },
        {
          topicName: "order.confirmed",
          topicHandler: async (msg) => {
            if (msg.value) await handleOrderCreated(msg.value);
          },
        },
        {
          topicName: "order-successful",
          topicHandler: async (msg) => {
            if (msg.value) await handleOrderCreated(msg.value);
          },
        },
        {
          topicName: "payment.successful",
          topicHandler: async (msg) => {
            if (msg.value) await handleOrderCreated(msg.value);
          },
        },
        {
          topicName: "payment-successful",
          topicHandler: async (msg) => {
            if (msg.value) await handleOrderCreated(msg.value);
          },
        },
        {
          topicName: "user.deleted",
          topicHandler: async (msg) => {
            if (msg.value) await handleUserDeleted(msg.value);
          },
        },
      ]);
    } catch (err) {
      logger.warn("Kafka consumer connection deferred / offline", {
        error: String(err),
      });
    }

    // 3. Start background expiration worker
    startCartExpirationWorker(60000);

    // 4. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      logger.info(
        `Cart service running on port ${env.PORT} in ${env.NODE_ENV} mode`,
      );
    });

    const shutdown = async (signal: string) => {
      logger.info("Shutting down cart-service gracefully...", { signal });
      stopCartExpirationWorker();
      server.close(async () => {
        await closeCartDB();
        await redis.close();
        await disconnectKafka();
        try {
          await consumer.disconnect();
        } catch {}
        logger.info("Cart service shutdown complete");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.fatal("Failed to initialize cart-service", error);
    process.exit(1);
  }
};

startServer().catch((error) => {
  logger.fatal("Unhandled startup rejection in cart-service", error);
  process.exit(1);
});
