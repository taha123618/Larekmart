import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../observability/logger.js";
import {
  gatewayRequestErrorsTotal,
  gatewayUpstreamErrorsTotal,
  gatewayUpstreamTimeoutTotal,
} from "../observability/metrics.js";

export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const requestId =
    (request.headers["x-request-id"] as string) || String(request.id);
  const statusCode = error.statusCode || 500;
  const cause = (
    error as { cause?: { code?: string; cause?: { code?: string } } }
  ).cause;
  const errorCode = error.code || cause?.code || cause?.cause?.code;

  // Track upstream connection / timeout errors specifically
  if (
    errorCode === "ECONNREFUSED" ||
    errorCode === "ENOTFOUND" ||
    errorCode === "EHOSTUNREACH" ||
    errorCode === "UND_ERR_SOCKET"
  ) {
    gatewayUpstreamErrorsTotal.inc({
      route: request.url,
      code: errorCode,
    });

    logger.error("Upstream service connection failed", {
      requestId,
      method: request.method,
      url: request.url,
      code: errorCode,
      message: error.message,
    });

    reply.status(503).send({
      statusCode: 503,
      error: "Service Unavailable",
      message: "Target microservice is temporarily unavailable",
      requestId,
    });
    return;
  }

  if (
    errorCode === "ETIMEDOUT" ||
    errorCode === "ECONNRESET" ||
    errorCode === "UND_ERR_CONNECT_TIMEOUT" ||
    errorCode === "UND_ERR_HEADERS_TIMEOUT"
  ) {
    gatewayUpstreamTimeoutTotal.inc({
      route: request.url,
    });

    logger.warn("Upstream service timeout or reset", {
      requestId,
      method: request.method,
      url: request.url,
      code: errorCode,
      message: error.message,
    });

    reply.status(504).send({
      statusCode: 504,
      error: "Gateway Timeout",
      message: "Target microservice did not respond in time",
      requestId,
    });
    return;
  }

  gatewayRequestErrorsTotal.inc({
    route: request.url,
    status: String(statusCode),
  });

  logger.error("Gateway request error", {
    requestId,
    method: request.method,
    url: request.url,
    statusCode,
    message: error.message,
    stack: statusCode >= 500 ? error.stack : undefined,
  });

  const isServerError = statusCode >= 500;
  const clientMessage = isServerError
    ? "An unexpected internal gateway error occurred"
    : error.message || "An error occurred";

  reply.status(statusCode).send({
    statusCode,
    error: error.name || (isServerError ? "Internal Server Error" : "Error"),
    message: clientMessage,
    requestId,
  });
}
