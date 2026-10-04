import type { FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { type CustomJwtSessionClaims, GATEWAY_HEADERS } from "@repo/types";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userRole?: string;
  }
}

export const shouldBeUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = request.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as string | undefined;
  const gatewayUserId = request.headers?.[GATEWAY_HEADERS.USER_ID] as string | undefined;
  const gatewayUserRole = request.headers?.[GATEWAY_HEADERS.USER_ROLE] as string | undefined;

  if (
    internalSecret &&
    env.INTERNAL_SERVICE_SECRET &&
    internalSecret === env.INTERNAL_SERVICE_SECRET &&
    gatewayUserId
  ) {
    request.userId = gatewayUserId;
    request.userRole = gatewayUserRole;
    return;
  }

  // 2. Direct Clerk token verification
  const { userId } = getAuth(request);
  if (!userId) {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "You must be authenticated to access this resource",
      },
    });
  }

  request.userId = userId;
};

export const shouldBeAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = request.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as string | undefined;
  const gatewayUserId = request.headers?.[GATEWAY_HEADERS.USER_ID] as string | undefined;
  const gatewayUserRole = request.headers?.[GATEWAY_HEADERS.USER_ROLE] as string | undefined;

  if (
    internalSecret &&
    env.INTERNAL_SERVICE_SECRET &&
    internalSecret === env.INTERNAL_SERVICE_SECRET &&
    gatewayUserId
  ) {
    if (gatewayUserRole !== "admin") {
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: "Admin privileges required to access this resource",
        },
      });
    }
    request.userId = gatewayUserId;
    request.userRole = gatewayUserRole;
    return;
  }

  // 2. Direct Clerk token verification
  const auth = getAuth(request);
  if (!auth.userId) {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "You must be authenticated to access this resource",
      },
    });
  }

  const claims = auth.sessionClaims as CustomJwtSessionClaims;
  if (claims?.metadata?.role !== "admin") {
    return reply.status(403).send({
      error: {
        code: "FORBIDDEN",
        message: "Admin privileges required to access this resource",
      },
    });
  }

  request.userId = auth.userId;
};
