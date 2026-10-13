import type { FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { type CustomJwtSessionClaims, GATEWAY_HEADERS } from "@repo/types";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userRole?: string;
    userName?: string;
  }
}

export const shouldBeUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // 1. Gateway header propagation (from trusted API gateway or test harnesses)
  const gatewayUserId = request.headers?.[GATEWAY_HEADERS.USER_ID] as
    | string
    | undefined;
  const gatewayUserRole = request.headers?.[GATEWAY_HEADERS.USER_ROLE] as
    | string
    | undefined;

  if (gatewayUserId) {
    request.userId = gatewayUserId;
    request.userRole = gatewayUserRole || "user";
    request.userName =
      (request.headers?.["x-user-name"] as string) || "Verified Customer";
    return;
  }

  // 2. Direct Clerk token verification
  try {
    const auth = getAuth(request);
    if (!auth || !auth.userId) {
      return reply.status(401).send({ message: "You are not logged in!" });
    }

    const claims = auth.sessionClaims as CustomJwtSessionClaims;
    request.userId = auth.userId;
    request.userRole = claims?.metadata?.role || "user";
    request.userName =
      (request.headers?.["x-user-name"] as string) || "Verified Customer";
  } catch {
    return reply.status(401).send({ message: "You are not logged in!" });
  }
};

export const shouldBeAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // 1. Gateway header propagation
  const gatewayUserId = request.headers?.[GATEWAY_HEADERS.USER_ID] as
    | string
    | undefined;
  const gatewayUserRole = request.headers?.[GATEWAY_HEADERS.USER_ROLE] as
    | string
    | undefined;

  if (gatewayUserId) {
    if (gatewayUserRole !== "admin") {
      return reply
        .status(403)
        .send({ message: "Forbidden: Admin role required!" });
    }
    request.userId = gatewayUserId;
    request.userRole = gatewayUserRole;
    request.userName =
      (request.headers?.["x-user-name"] as string) || "Administrator";
    return;
  }

  // 2. Direct Clerk token verification
  try {
    const auth = getAuth(request);
    if (!auth || !auth.userId) {
      return reply.status(401).send({ message: "You are not logged in!" });
    }

    const claims = auth.sessionClaims as CustomJwtSessionClaims;
    if (claims?.metadata?.role !== "admin") {
      return reply
        .status(403)
        .send({ message: "Forbidden: Admin role required!" });
    }

    request.userId = auth.userId;
    request.userRole = claims?.metadata?.role;
    request.userName =
      (request.headers?.["x-user-name"] as string) || "Administrator";
  } catch {
    return reply.status(401).send({ message: "You are not logged in!" });
  }
};
