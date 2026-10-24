import type { FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import type { CustomJwtSessionClaims } from "@repo/types";

export interface AuthenticatedUser {
  userId: string;
  role: "admin" | "seller" | "customer" | "super_admin";
  isSuperAdmin: boolean;
  isSeller: boolean;
  canManageSellers: boolean;
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
    const anyClaims = claims as Record<string, unknown> | undefined;
    const isSeller =
      rawRole === "seller" ||
      claims?.metadata?.isSeller === true ||
      anyClaims?.isSeller === true ||
      (anyClaims?.publicMetadata as Record<string, unknown> | undefined)
        ?.isSeller === true;
    const canManageSellers =
      isSuperAdmin ||
      claims?.metadata?.canManageSellers === true ||
      (Array.isArray(claims?.metadata?.permissions) &&
        claims.metadata.permissions.includes("manage_sellers"));

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
      canManageSellers,
      claims,
    };
  } catch {
    return null;
  }
}
