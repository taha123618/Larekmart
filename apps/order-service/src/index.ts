import Fastify from "fastify";
import Clerk from "@clerk/fastify";
import { shouldBeUser } from "./middleware/authMiddleware.js";
import { connectOrderDB, mongoose } from "@repo/order-db";
import { orderRoute } from "./routes/order.js";
import { consumer, producer } from "./utils/kafka.js";
import { runKafkaSubscriptions } from "./utils/subscriptions.js";
import {
  createLogger,
  createHealthRegistry,
  createMetricsRegistry,
  createHttpMonitor,
  createMemoryCheck,
  createDbCheck,
} from "@repo/monitoring";

const logger = createLogger("order-service");
const metrics = createMetricsRegistry("order-service");
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

const fastify = Fastify();

fastify.register(Clerk.clerkPlugin);

// HTTP Monitoring hooks
const requestHooks = new Map<
  string,
  { onRequestEnd: (status: number) => void }
>();

fastify.addHook("onRequest", async (request) => {
  if (request.url === "/health" || request.url === "/metrics") return;
  const hook = httpMonitor.onRequestStart({
    method: request.method,
    url: request.url,
  });
  requestHooks.set(request.id, hook);
});

fastify.addHook("onResponse", async (request, reply) => {
  const hook = requestHooks.get(request.id);
  if (hook) {
    hook.onRequestEnd(reply.statusCode);
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
    await fastify.listen({ port: 8001 });
    logger.info("Order service is running on port 8001");
  } catch (err) {
    logger.fatal("Failed to initialize order-service", err);
    process.exit(1);
  }
};
start();
