import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { clerkPlugin, getAuth } from "@clerk/fastify";
import type { CustomJwtSessionClaims } from "@repo/types";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyRequest {
    authUserId?: string;
    userRole?: string;
    userPermissions?: string[];
  }
}

export async function registerAuthMiddleware(
  fastify: FastifyInstance,
): Promise<void> {
  // Register Clerk plugin
  await fastify.register(clerkPlugin, {
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  });

  // Extract identity and attach internal trusted headers
  fastify.addHook("preHandler", async (request) => {
    try {
      const auth = getAuth(request);
      if (auth?.userId) {
        const claims = auth.sessionClaims as CustomJwtSessionClaims | undefined;
        const role = claims?.metadata?.role || "customer";

        request.authUserId = auth.userId;
        request.userRole = role;

        // Populate trusted identity headers for downstream proxy propagation
        request.headers["x-user-id"] = auth.userId;
        request.headers["x-user-role"] = role;
        request.headers["x-internal-secret"] = env.INTERNAL_SERVICE_SECRET;
      }
    } catch {
      // Unauthenticated or anonymous request — headers remain unset
    }
  });
}

// Coarse-grained authorization hooks
export const requireAuth = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (!request.authUserId) {
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
) => {
  if (!request.authUserId) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Authentication required to access this resource",
      requestId: request.headers["x-request-id"],
    });
  }

  if (request.userRole !== "admin") {
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
) => {
  if (!request.authUserId) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Authentication required to access this resource",
      requestId: request.headers["x-request-id"],
    });
  }

  if (request.userRole !== "seller" && request.userRole !== "admin") {
    return reply.status(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Seller or Admin role required to access this resource",
      requestId: request.headers["x-request-id"],
    });
  }
};
