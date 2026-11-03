import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { type CustomJwtSessionClaims, GATEWAY_HEADERS } from "@repo/types";
import { config } from "../config/env.js";

declare module "fastify" {
  interface FastifyRequest {
    authUserId?: string;
    userId?: string;
    userRole?: string;
  }
}

function safeTimingCompare(a: string, b: string): boolean {
  try {
    const hashA = crypto.createHash("sha256").update(a).digest();
    const hashB = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  } catch {
    return false;
  }
}

export const shouldBeUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = request.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as
    | string
    | undefined;
  const gatewayUserId = request.headers?.[GATEWAY_HEADERS.USER_ID] as
    | string
    | undefined;
  const gatewayUserRole = request.headers?.[GATEWAY_HEADERS.USER_ROLE] as
    | string
    | undefined;

  if (
    internalSecret &&
    config.internalServiceSecret &&
    safeTimingCompare(internalSecret, config.internalServiceSecret) &&
    gatewayUserId
  ) {
    request.authUserId = gatewayUserId;
    request.userId = gatewayUserId;
    request.userRole = gatewayUserRole;
    return;
  }

  // 2. Fallback: Direct Clerk token verification
  const auth = getAuth(request);
  if (!auth.userId) {
    return reply.status(401).send({ message: "You are not logged in!" });
  }

  const claims = auth.sessionClaims as CustomJwtSessionClaims;
  request.authUserId = auth.userId;
  request.userId = auth.userId;
  request.userRole = claims?.metadata?.role;
};

export const shouldBeAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = request.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as
    | string
    | undefined;
  const gatewayUserId = request.headers?.[GATEWAY_HEADERS.USER_ID] as
    | string
    | undefined;
  const gatewayUserRole = request.headers?.[GATEWAY_HEADERS.USER_ROLE] as
    | string
    | undefined;

  if (
    internalSecret &&
    config.internalServiceSecret &&
    safeTimingCompare(internalSecret, config.internalServiceSecret) &&
    gatewayUserId
  ) {
    if (gatewayUserRole !== "admin") {
      return reply
        .status(403)
        .send({ message: "Forbidden: Admin role required!" });
    }
    request.authUserId = gatewayUserId;
    request.userId = gatewayUserId;
    request.userRole = gatewayUserRole;
    return;
  }

  // 2. Fallback: Direct Clerk token verification
  const auth = getAuth(request);
  if (!auth.userId) {
    return reply.status(401).send({ message: "You are not logged in!" });
  }

  const claims = auth.sessionClaims as CustomJwtSessionClaims;
  if (claims?.metadata?.role !== "admin") {
    return reply
      .status(403)
      .send({ message: "Forbidden: Admin role required!" });
  }

  request.authUserId = auth.userId;
  request.userId = auth.userId;
  request.userRole = claims?.metadata?.role;
};

export const shouldBeInternalOrAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const internalSecret = request.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as
    | string
    | undefined;
  const gatewayUserId = request.headers?.[GATEWAY_HEADERS.USER_ID] as
    | string
    | undefined;
  const gatewayUserRole = request.headers?.[GATEWAY_HEADERS.USER_ROLE] as
    | string
    | undefined;

  const isInternal =
    typeof internalSecret === "string" &&
    Boolean(config.internalServiceSecret) &&
    safeTimingCompare(internalSecret, config.internalServiceSecret);

  // Pure machine-to-machine internal service call without user context
  if (isInternal && !gatewayUserId && !gatewayUserRole) {
    return;
  }

  return shouldBeAdmin(request, reply);
};
