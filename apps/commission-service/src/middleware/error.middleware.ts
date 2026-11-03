import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof ZodError) {
    reply.status(400).send({
      message: "Validation failed",
      errors: error.flatten().fieldErrors,
    });
    return;
  }

  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    message: error.message || "Internal server error",
  });
}
