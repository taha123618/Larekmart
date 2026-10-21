import type { FastifyInstance } from "fastify";
import { checkDatabaseConnection } from "../db/connection.js";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async (_req, reply) => {
    const dbHealth = await checkDatabaseConnection();
    const status = dbHealth.healthy ? "healthy" : "degraded";
    return reply.status(dbHealth.healthy ? 200 : 503).send({
      service: "pricing-service",
      status,
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbHealth.healthy ? "connected" : "disconnected",
      },
    });
  });

  fastify.get("/ready", async (_req, reply) => {
    const dbHealth = await checkDatabaseConnection();
    return reply.status(dbHealth.healthy ? 200 : 503).send({
      service: "pricing-service",
      ready: dbHealth.healthy,
      timestamp: new Date().toISOString(),
    });
  });

  fastify.get("/api/v1/prices/health", async (_req, reply) => {
    const dbHealth = await checkDatabaseConnection();
    return reply.status(dbHealth.healthy ? 200 : 503).send({
      service: "pricing-service",
      status: dbHealth.healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
    });
  });

  fastify.get("/metrics", async (_req, reply) => {
    return reply.status(200).send({
      service: "pricing-service",
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  });
}
