import type { FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import type { CustomJwtSessionClaims } from "@repo/types";

export interface AuthenticatedUser {
  userId: string;
  role: "admin" | "seller" | "customer";
  claims?: CustomJwtSessionClaims;
}

export function extractAuthClaims(
  request: FastifyRequest,
): AuthenticatedUser | null {
  try {
    const auth = getAuth(request);
    if (!auth?.userId) {
      return null;
    }

    const claims = auth.sessionClaims as CustomJwtSessionClaims | undefined;
    const role =
      (claims?.metadata?.role as "admin" | "seller" | "customer") || "customer";

    return {
      userId: auth.userId,
      role,
      claims,
    };
  } catch {
    return null;
  }
}
