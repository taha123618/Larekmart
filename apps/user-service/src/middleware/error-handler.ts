import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { logger } from "../observability/metrics.js";

export function globalErrorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // 1. Zod Validation Errors
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));

    void reply.status(400).send({
      message: "Validation failed: " + formattedErrors.map(e => `${e.field}: ${e.message}`).join(", "),
      errors: formattedErrors,
    });
    return;
  }

  // 2. Fastify Route Errors or Custom Errors
  const statusCode = (error as FastifyError).statusCode || 500;

  if (statusCode >= 500) {
    logger.error("Internal server error in user-service", {
      url: request.url,
      method: request.method,
      statusCode,
      error: error.message,
      stack: error.stack,
    });
  } else {
    logger.warn("Request failed with client error", {
      url: request.url,
      method: request.method,
      statusCode,
      error: error.message,
    });
  }

  void reply.status(statusCode).send({
    message: error.message || "An unexpected error occurred",
  });
}
