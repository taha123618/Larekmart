import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { type CustomJwtSessionClaims, GATEWAY_HEADERS } from "@repo/types";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userRole?: string;
    userName?: string;
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
  // 1. Gateway header propagation (only trusted if valid internal secret matches)
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
    env.INTERNAL_SERVICE_SECRET &&
    safeTimingCompare(internalSecret, env.INTERNAL_SERVICE_SECRET) &&
    gatewayUserId
  ) {
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
  // 1. Gateway header propagation (only trusted if valid internal secret matches)
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
    env.INTERNAL_SERVICE_SECRET &&
    safeTimingCompare(internalSecret, env.INTERNAL_SERVICE_SECRET) &&
    gatewayUserId
  ) {
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
