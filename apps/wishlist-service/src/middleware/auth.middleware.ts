import type { FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { type CustomJwtSessionClaims, GATEWAY_HEADERS } from "@repo/types";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userRole?: string;
    userName?: string;
    guestId?: string;
  }
}

export const shouldBeUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // 1. Gateway header propagation (from API gateway or test harnesses)
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
  // 1. Gateway or direct user resolution
  const gatewayUserId = request.headers?.[GATEWAY_HEADERS.USER_ID] as
    | string
    | undefined;
  if (gatewayUserId) {
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
