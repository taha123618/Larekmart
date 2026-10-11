import Fastify from "fastify";
import cors from "@fastify/cors";
import { clerkPlugin, getAuth } from "@clerk/fastify";
import { shouldBeUser } from "./middleware/authMiddleware.js";
import { connectOrderDB, mongoose } from "@repo/order-db";
import { orderRoute } from "./routes/order.js";
import { consumer, producer } from "./utils/kafka.js";
import { runKafkaSubscriptions } from "./utils/subscriptions.js";
import {
  createHealthRegistry,
  createHttpMonitor,
  createMemoryCheck,
  createDbCheck,
} from "@repo/monitoring";
import { logger, metrics } from "./observability/metrics.js";
import { redis } from "./utils/redis.js";

const httpMonitor = createHttpMonitor(logger, metrics);
const health = createHealthRegistry("order-service", "1.0.0");

// Register health checks
health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});
health.register(
  "mongodb",
  createDbCheck("MongoDB", async () => {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("MongoDB connection state is not connected");
    }
  }),
  { critical: true },
);
// Redis only backs the order-chart cache, so losing it degrades performance but
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

const fastify = Fastify();

// Register CORS with strict allowed origins
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3002",
  process.env.ADMIN_URL || "http://localhost:3003",
];

await fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-request-id",
    "X-Request-ID",
    "x-user-id",
    "X-User-ID",
    "x-correlation-id",
  ],
});

// Defensive HTTP Security Headers
fastify.addHook("onSend", async (request, reply) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
});

// Global Error Handler
fastify.setErrorHandler((error: any, request, reply) => {
  logger.error("Order service request error", {
    url: request.url,
    method: request.method,
    error: error.message,
    stack: error.stack,
  });

  const statusCode = error.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";
  const safeMessage =
    statusCode >= 500 && isProd
      ? "Internal Server Error"
      : error.message || "Internal server error";

  return reply.status(statusCode).send({
    message: safeMessage,
  });
});

fastify.register(clerkPlugin);

// HTTP Monitoring hooks
const requestHooks = new Map<
  string,
  {
    onRequestEnd: (status: number, extraMeta?: Record<string, unknown>) => void;
  }
>();

fastify.addHook("onRequest", async (request) => {
  if (request.url === "/health" || request.url === "/metrics") return;

  const requestId =
    (request.headers["x-request-id"] as string) ||
    (request.headers["x-correlation-id"] as string) ||
    (request.id ? String(request.id) : undefined);

  let userId = (request.headers["x-user-id"] as string) || undefined;
  if (!userId) {
    try {
      const auth = getAuth(request);
      if (auth?.userId) {
        userId = auth.userId;
      }
    } catch {
      // Optional auth on preflight/public endpoints
    }
  }

  const hook = httpMonitor.onRequestStart({
    method: request.method,
    url: request.url,
    requestId: requestId || `req-${request.id}`,
    userId: userId || "guest",
  });
  requestHooks.set(request.id, hook);
});

fastify.addHook("onResponse", async (request, reply) => {
  const hook = requestHooks.get(request.id);
  if (hook) {
    let userId =
      request.userId || (request.headers["x-user-id"] as string) || undefined;
    if (!userId) {
      try {
        const auth = getAuth(request);
        if (auth?.userId) {
          userId = auth.userId;
        }
      } catch {
        // ignore
      }
    }

    const requestId =
      (request.headers["x-request-id"] as string) ||
      (request.headers["x-correlation-id"] as string) ||
      (request.id ? String(request.id) : undefined);

    hook.onRequestEnd(reply.statusCode, {
      requestId: requestId || `req-${request.id}`,
      userId: userId || "guest",
    });
    requestHooks.delete(request.id);
  }
});

fastify.get("/health", async (request, reply) => {
  const report = await health.runChecks();
  const statusCode = report.status === "unhealthy" ? 503 : 200;
  return reply.status(statusCode).send(report);
});

fastify.get("/metrics", async (request, reply) => {
  return reply
    .header("Content-Type", "text/plain; version=0.0.4")
    .send(metrics.toPrometheus());
});

fastify.get("/test", { preHandler: shouldBeUser }, (request, reply) => {
  return reply.send({
    message: "Order service is authenticated!",
    userId: request.userId,
  });
});

fastify.register(orderRoute);

const start = async () => {
  try {
    await Promise.all([
      connectOrderDB(),
      producer.connect(),
      consumer.connect(),
    ]);
    await runKafkaSubscriptions();
    await fastify.listen({
      port: 8001,
      host: process.env.HOST || "0.0.0.0",
    });
    logger.info("Order service is running on port 8001");
  } catch (err) {
    logger.fatal("Failed to initialize order-service", err);
    process.exit(1);
  }
};
start();
