import type { FastifyReply, FastifyRequest } from "fastify";

export async function livenessHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  return reply.status(200).send({
    status: "ok",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
