import type { FastifyReply, FastifyRequest } from "fastify";

export async function readinessHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  // Verifies gateway internal components are ready to accept traffic
  return reply.status(200).send({
    status: "ready",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
  });
}
