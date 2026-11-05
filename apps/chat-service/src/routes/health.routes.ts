import { FastifyInstance } from "fastify";
import { checkDatabaseConnection } from "../db/connection.js";
import { getRedisClient } from "../middleware/idempotency.middleware.js";

export async function registerHealthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/health", async (_request, reply) => {
    return reply.send({
      service: "chat-service",
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/ready", async (_request, reply) => {
    const dbStatus = await checkDatabaseConnection();
    let redisHealthy = false;

    try {
      const redis = getRedisClient();
      await redis.ping();
      redisHealthy = true;
    } catch {
      redisHealthy = false;
    }

    const isReady = dbStatus.healthy && redisHealthy;

    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? "ready" : "degraded",
      service: "chat-service",
      checks: {
        database: dbStatus.healthy ? "connected" : "unhealthy",
        redis: redisHealthy ? "connected" : "unhealthy",
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/metrics", async (_request, reply) => {
    const metrics = [
      "# HELP chat_active_connections Current number of active WebSocket connections",
      "# TYPE chat_active_connections gauge",
      "chat_active_connections 0",
      "# HELP chat_messages_sent_total Total chat messages sent",
      "# TYPE chat_messages_sent_total counter",
      "chat_messages_sent_total 0",
    ].join("\n");

    return reply.header("content-type", "text/plain").send(metrics);
  });
}
