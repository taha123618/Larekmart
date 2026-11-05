import type { FastifyInstance } from "fastify";
import { checkDatabaseHealth } from "../db/connection.js";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async (_request, reply) => {
    const dbHealth = await checkDatabaseHealth();
    const isHealthy = dbHealth.status === "up";

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? "healthy" : "degraded",
      service: "commission-service",
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbHealth,
      },
    });
  });

  fastify.get("/ready", async (_request, reply) => {
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.status !== "up") {
      return reply
        .status(503)
        .send({ status: "not_ready", error: dbHealth.error });
    }
    return reply.status(200).send({ status: "ready" });
  });

  fastify.get("/metrics", async (_request, reply) => {
    return reply.status(200).send({
      service: "commission-service",
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
    });
  });
}
