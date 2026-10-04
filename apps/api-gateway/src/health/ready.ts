import type { FastifyReply, FastifyRequest } from "fastify";
import { checkRedisHealth } from "../cache/redis.js";

export async function readinessHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  // Check Redis infrastructure state (non-blocking if Redis is down or optional)
  const isRedisOk = await checkRedisHealth().catch(() => false);

  return reply.status(200).send({
    status: "ready",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    checks: {
      configuration: "ok",
      redis: isRedisOk ? "ok" : "degraded",
    },
  });
}
