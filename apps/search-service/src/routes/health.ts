import type { FastifyPluginAsync } from "fastify";
import { getOpenSearchClient, checkOpenSearchConnection } from "../opensearch/client.js";
import { checkRedisConnection } from "../cache/redis.js";
import { metrics } from "../observability/metrics.js";

function getClientForHealthCheck() {
  return getOpenSearchClient();
}

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Liveness Check (Process is running)
  fastify.get("/health", async (request, reply) => {
    return reply.status(200).send({
      status: "ok",
      service: "search-service",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Readiness Check (Dependencies are reachable)
  fastify.get("/ready", async (request, reply) => {
    const [opensearchHealthy, redisHealthy] = await Promise.all([
      checkOpenSearchConnection(getClientForHealthCheck()),
      checkRedisConnection(),
    ]);

    const isReady = opensearchHealthy; // OpenSearch is strictly required; Redis can failover
    const statusCode = isReady ? 200 : 503;

    return reply.status(statusCode).send({
      status: isReady ? "ready" : "not_ready",
      service: "search-service",
      timestamp: new Date().toISOString(),
      checks: {
        opensearch: opensearchHealthy ? "healthy" : "unhealthy",
        redis: redisHealthy ? "healthy" : "degraded",
      },
    });
  });

  // Prometheus Metrics
  fastify.get("/metrics", async (request, reply) => {
    return reply
      .header("Content-Type", "text/plain; version=0.0.4")
      .send(metrics.toPrometheus());
  });
};
