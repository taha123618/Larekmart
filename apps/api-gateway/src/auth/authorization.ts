import type { FastifyReply, FastifyRequest } from "fastify";
import { gatewayAuthFailuresTotal } from "../observability/metrics.js";
import { logger } from "../observability/logger.js";

export const requireAuth = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (!request.authUserId) {
    gatewayAuthFailuresTotal.inc({
      reason: "missing_or_invalid_token",
      route: request.url,
    });
    logger.warn("Authentication failed: Missing or invalid token", {
      url: request.url,
      method: request.method,
      requestId: request.headers["x-request-id"],
    });

    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Authentication required to access this resource",
      requestId: request.headers["x-request-id"],
    });
  }
};

export const requireAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (!request.authUserId) {
    gatewayAuthFailuresTotal.inc({
      reason: "unauthenticated_admin_access",
      route: request.url,
    });
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Authentication required to access this resource",
      requestId: request.headers["x-request-id"],
    });
  }

  if (request.userRole !== "admin") {
    gatewayAuthFailuresTotal.inc({
      reason: "forbidden_non_admin",
      route: request.url,
    });
    logger.warn(
      "Authorization failed: Non-admin attempted to access admin route",
      {
        userId: request.authUserId,
        userRole: request.userRole,
        url: request.url,
        requestId: request.headers["x-request-id"],
      },
    );

    return reply.status(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Admin role required to access this resource",
      requestId: request.headers["x-request-id"],
    });
  }
};

export const requireSeller = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (!request.authUserId) {
    gatewayAuthFailuresTotal.inc({
      reason: "unauthenticated_seller_access",
      route: request.url,
    });
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Authentication required to access this resource",
      requestId: request.headers["x-request-id"],
    });
  }

  if (request.userRole !== "seller" && request.userRole !== "admin") {
    gatewayAuthFailuresTotal.inc({
      reason: "forbidden_non_seller",
      route: request.url,
    });
    logger.warn(
      "Authorization failed: Non-seller attempted to access seller route",
      {
        userId: request.authUserId,
        userRole: request.userRole,
        url: request.url,
        requestId: request.headers["x-request-id"],
      },
    );

    return reply.status(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Seller or Admin role required to access this resource",
      requestId: request.headers["x-request-id"],
    });
  }
};
