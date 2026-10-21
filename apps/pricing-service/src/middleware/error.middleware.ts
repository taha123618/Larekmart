import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error(error);

  if (error instanceof ZodError) {
    reply.status(400).send({
      message: "Validation failed",
      errors: error.issues.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    message: error.message || "Internal server error",
  });
}
