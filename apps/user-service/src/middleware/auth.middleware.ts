import type { FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import type { CustomJwtSessionClaims } from "@repo/types";
import { config } from "../config/env.js";

declare module "fastify" {
  interface FastifyRequest {
    authUserId?: string;
    userId?: string;
    userRole?: string;
  }
}

export const shouldBeUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
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
  const internalSecret = request.headers["x-internal-secret"];
  if (internalSecret && internalSecret === config.internalServiceSecret) {
    return;
  }

  return shouldBeAdmin(request, reply);
};
