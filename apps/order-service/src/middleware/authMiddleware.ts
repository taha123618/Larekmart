import { FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { type CustomJwtSessionClaims, GATEWAY_HEADERS } from "@repo/types";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userRole?: string;
  }
}

export const shouldBeUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = request.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as string | undefined;
  const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
  const gatewayUserId = request.headers?.[GATEWAY_HEADERS.USER_ID] as string | undefined;
  const gatewayUserRole = request.headers?.[GATEWAY_HEADERS.USER_ROLE] as string | undefined;

  if (
    internalSecret &&
    configuredSecret &&
    internalSecret === configuredSecret &&
    gatewayUserId
  ) {
    request.userId = gatewayUserId;
    request.userRole = gatewayUserRole;
    return;
  }

  // 2. Fallback: Direct Clerk token verification
  const auth = getAuth(request);
  if (!auth?.userId) {
    return reply.status(401).send({ message: "You are not logged in!" });
  }

  const claims = auth.sessionClaims as CustomJwtSessionClaims;
  request.userId = auth.userId;
  request.userRole = claims?.metadata?.role;
};

export const shouldBeAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = request.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as string | undefined;
  const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
  const gatewayUserId = request.headers?.[GATEWAY_HEADERS.USER_ID] as string | undefined;
  const gatewayUserRole = request.headers?.[GATEWAY_HEADERS.USER_ROLE] as string | undefined;

  if (
    internalSecret &&
    configuredSecret &&
    internalSecret === configuredSecret &&
    gatewayUserId
  ) {
    if (gatewayUserRole !== "admin") {
      return reply.status(403).send({ message: "Unauthorized!" });
    }
    request.userId = gatewayUserId;
    request.userRole = gatewayUserRole;
    return;
  }

  // 2. Fallback: Direct Clerk token verification
  const auth = getAuth(request);
  if (!auth?.userId) {
    return reply.status(401).send({ message: "You are not logged in!" });
  }

  const claims = auth.sessionClaims as CustomJwtSessionClaims;

  if (claims?.metadata?.role !== "admin") {
    return reply.status(403).send({ message: "Unauthorized!" });
  }

  request.userId = auth.userId;
  request.userRole = claims?.metadata?.role;
};

