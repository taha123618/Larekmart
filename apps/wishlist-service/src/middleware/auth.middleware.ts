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
    guestId?: string;
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
      (request.headers?.["x-user-name"] as string) || "Customer";
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
      (request.headers?.["x-user-name"] as string) || "Customer";
  } catch {
    return reply.status(401).send({ message: "You are not logged in!" });
  }
};

export const optionalUserOrGuest = async (
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

  if (
    internalSecret &&
    env.INTERNAL_SERVICE_SECRET &&
    safeTimingCompare(internalSecret, env.INTERNAL_SERVICE_SECRET) &&
    gatewayUserId
  ) {
    request.userId = gatewayUserId;
    request.userRole =
      (request.headers?.[GATEWAY_HEADERS.USER_ROLE] as string) || "user";
    return;
  }

  try {
    const auth = getAuth(request);
    if (auth?.userId) {
      request.userId = auth.userId;
      return;
    }
  } catch {
    // Ignore Clerk error in optional check
  }

  // 2. Guest ID resolution from headers or query
  const guestHeader = (request.headers?.["x-guest-id"] ||
    request.headers?.["x-session-id"]) as string | undefined;
  const queryGuestId = (request.query as Record<string, string>)?.guestId;

  const resolvedGuestId = guestHeader || queryGuestId;
  if (resolvedGuestId) {
    request.guestId = resolvedGuestId;
    return;
  }

  // Neither user nor guest present
  if (!request.userId && !request.guestId) {
    return reply
      .status(401)
      .send({ message: "Authentication or guest identifier required" });
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
        .send({ message: "Forbidden: Admin role required" });
    }
    request.userId = gatewayUserId;
    request.userRole = gatewayUserRole;
    return;
  }

  try {
    const auth = getAuth(request);
    if (!auth || !auth.userId) {
      return reply.status(401).send({ message: "You are not logged in!" });
    }

    const claims = auth.sessionClaims as CustomJwtSessionClaims;
    const role = claims?.metadata?.role;
    if (role !== "admin") {
      return reply
        .status(403)
        .send({ message: "Forbidden: Admin role required" });
    }

    request.userId = auth.userId;
    request.userRole = role;
  } catch {
    return reply.status(401).send({ message: "You are not logged in!" });
  }
};
