import type { ErrorHandler } from "hono";
import { captureError } from "@repo/monitoring";
import { AppError } from "@repo/monitoring";
import { logger } from "../observability/metrics.js";

/**
 * Error-handling boundary (spec section 40): domain errors return their
 * status + safe message; anything unexpected is logged with full detail and
 * returned as a generic 500. Never expose S3 credentials, bucket internals,
 * database errors, stack traces, or filesystem paths.
 */
export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof AppError) {
    return c.json(
      { message: error.message, code: error.code },
      error.statusCode as 400 | 401 | 403 | 404 | 409 | 413 | 415 | 500 | 502,
    );
  }

  const formatted = captureError(error, {
    serviceName: "media-service",
    logger,
    route: c.req.path,
  });

  return c.json(
    { message: "Internal Server Error" },
    (formatted.statusCode || 500) as 500,
  );
};
