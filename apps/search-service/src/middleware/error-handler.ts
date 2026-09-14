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
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: formattedErrors,
      },
    });
    return;
  }

  // 2. OpenSearch Errors
  if (error.name === "ResponseError" || error.name === "ConnectionError") {
    logger.error("OpenSearch cluster communication error", {
      route: request.url,
      error: error.message,
    });

    void reply.status(503).send({
      error: {
        code: "SEARCH_SERVICE_UNAVAILABLE",
        message:
          "Search cluster is temporarily unavailable. Please try again shortly.",
      },
    });
    return;
  }

  // 3. Fastify Route Errors (e.g. 404, 400)
  const statusCode = (error as FastifyError).statusCode || 500;
  logger.error("Unhandled error processing request", {
    url: request.url,
    method: request.method,
    statusCode,
    error: error.message,
    stack: error.stack,
  });

  void reply.status(statusCode).send({
    error: {
      code: statusCode === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred",
    },
  });
}
