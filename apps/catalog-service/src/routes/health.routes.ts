import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@repo/catalog-db";
import { redis } from "../utils/redis.js";
import { metrics } from "../observability/metrics.js";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Liveness Check
  fastify.get("/health", async (_request, reply) => {
    return reply.status(200).send({
      status: "ok",
      service: "catalog-service",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Readiness Check
  fastify.get("/ready", async (_request, reply) => {
    let dbHealthy = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }

    const redisHealthy = await redis.ping();
    const isReady = dbHealthy; // DB is essential for catalog-service
    const statusCode = isReady ? 200 : 503;

    return reply.status(statusCode).send({
      status: isReady ? "ready" : "not_ready",
      service: "catalog-service",
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? "healthy" : "unhealthy",
        redis: redisHealthy ? "healthy" : "degraded",
      },
    });
  });

  // Prometheus Metrics
  fastify.get("/metrics", async (_request, reply) => {
    return reply
      .header("Content-Type", "text/plain; version=0.0.4")
      .send(metrics.toPrometheus());
  });
};
