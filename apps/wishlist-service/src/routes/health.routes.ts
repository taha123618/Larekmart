import type { FastifyInstance } from "fastify";
import { checkWishlistHealth } from "../health/health.service.js";
import { metrics } from "../observability/metrics.js";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async (_req, reply) => {
    const health = await checkWishlistHealth();
    return reply.status(health.status === "healthy" ? 200 : 503).send(health);
  });

  fastify.get("/ready", async (_req, reply) => {
    const health = await checkWishlistHealth();
    return reply.status(health.status === "healthy" ? 200 : 503).send(health);
  });

  fastify.get("/metrics", async (_req, reply) => {
    const snapshot = metrics.getSnapshot();
    return reply.status(200).send(snapshot);
  });

  fastify.get("/api/v1/wishlists/health", async (_req, reply) => {
    const health = await checkWishlistHealth();
    return reply.status(health.status === "healthy" ? 200 : 503).send(health);
  });
}
