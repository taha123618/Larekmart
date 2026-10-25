import type { FastifyInstance } from "fastify";
import { clerkPlugin } from "@clerk/fastify";
import { env } from "../config/env.js";
import { extractAuthClaims } from "./token-verifier.js";
import { GATEWAY_HEADERS } from "@repo/types";

declare module "fastify" {
  interface FastifyRequest {
    authUserId?: string;
    userRole?: string;
    isSuperAdmin?: boolean;
    isSeller?: boolean;
    canManageSellers?: boolean;
    userPermissions?: string[];
  }
}

export async function registerAuthMiddleware(
  fastify: FastifyInstance,
): Promise<void> {
  await fastify.register(clerkPlugin, {
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  });

  fastify.addHook("preHandler", async (request) => {
    const auth = extractAuthClaims(request);
    if (auth?.userId) {
      request.authUserId = auth.userId;
      request.userRole = auth.role;
      request.isSuperAdmin = auth.isSuperAdmin;
      request.isSeller = auth.isSeller;
      request.canManageSellers = auth.canManageSellers;

      // Attach internal trusted headers for downstream proxy propagation
      request.headers[GATEWAY_HEADERS.USER_ID] = auth.userId;
      request.headers[GATEWAY_HEADERS.USER_ROLE] = auth.role;
      if (auth.isSuperAdmin) {
        request.headers[GATEWAY_HEADERS.IS_SUPER_ADMIN] = "true";
      }
      if (auth.isSeller) {
        request.headers[GATEWAY_HEADERS.IS_SELLER] = "true";
      }
      if (auth.canManageSellers) {
        request.headers[GATEWAY_HEADERS.CAN_MANAGE_SELLERS] = "true";
      }
      request.headers[GATEWAY_HEADERS.INTERNAL_SECRET] =
        env.INTERNAL_SERVICE_SECRET;
    }
  });
}
