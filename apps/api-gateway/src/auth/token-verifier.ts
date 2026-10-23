import type { FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import type { CustomJwtSessionClaims } from "@repo/types";

export interface AuthenticatedUser {
  userId: string;
  role: "admin" | "seller" | "customer" | "super_admin";
  isSuperAdmin: boolean;
  isSeller: boolean;
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
    const rawRole = claims?.metadata?.role;
    const isSuperAdmin =
      rawRole === "super_admin" || claims?.metadata?.isSuperAdmin === true;
    const isSeller =
      rawRole === "seller" || claims?.metadata?.isSeller === true;

    let role: "admin" | "seller" | "customer" | "super_admin" = "customer";
    if (isSuperAdmin) {
      role = "super_admin";
    } else if (rawRole === "admin") {
      role = "admin";
    } else if (isSeller) {
      role = "seller";
    }

    return {
      userId: auth.userId,
      role,
      isSuperAdmin,
      isSeller,
      claims,
    };
  } catch {
    return null;
  }
}
