import type { FastifyInstance } from "fastify";
import { checkDatabaseConnection } from "../db/connection.js";
import { redis } from "../utils/redis.js";

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const checkHealth = async () => {
    let dbStatus = "healthy";
    let redisStatus = "healthy";

    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.healthy) {
      dbStatus = "unhealthy";
    }

    try {
      const pong = await redis.client.ping();
      if (pong !== "PONG") redisStatus = "unhealthy";
    } catch {
      redisStatus = "unhealthy";
    }

    const isHealthy = dbStatus === "healthy";
    return {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      service: "tax-service",
      checks: {
        database: dbStatus,
        redis: redisStatus,
      },
    };
  };

  fastify.get("/health", async (_req, reply) => {
    const health = await checkHealth();
    return reply.status(health.status === "healthy" ? 200 : 503).send(health);
  });

  fastify.get("/ready", async (_req, reply) => {
    const health = await checkHealth();
    return reply.status(health.status === "healthy" ? 200 : 503).send(health);
  });

  fastify.get("/api/v1/tax/health", async (_req, reply) => {
    const health = await checkHealth();
    return reply.status(health.status === "healthy" ? 200 : 503).send(health);
  });
}
