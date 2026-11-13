import crypto from "node:crypto";
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
  // 1. Attempt standard Clerk cryptographic session extraction
  try {
    const auth = getAuth(request);
    if (auth?.userId) {
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
    }
  } catch {
    // Proceed to custom merchant session verification fallback
  }

  // 2. Dynamic Merchant / Seller JWT verification fallback (HS256 HMAC timing-safe)
  const authHeader = request.headers.authorization;
  if (
    authHeader &&
    typeof authHeader === "string" &&
    authHeader.startsWith("Bearer ")
  ) {
    const rawToken = authHeader.slice(7).trim();
    const parts = rawToken.split(".");
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      try {
        const hmacKey =
          process.env.CLERK_JWT_HMAC_KEY ||
          "larekmart_seller_hmac_secret_dev_key";
        const signedData = `${parts[0]}.${parts[1]}`;
        const signature = Buffer.from(parts[2], "base64url");
        const expectedSig = crypto
          .createHmac("sha256", hmacKey)
          .update(signedData)
          .digest();

        const sigHash = crypto.createHash("sha256").update(signature).digest();
        const expectedHash = crypto
          .createHash("sha256")
          .update(expectedSig)
          .digest();

        if (crypto.timingSafeEqual(sigHash, expectedHash)) {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf-8"),
          ) as {
            sub?: string;
            role?: string;
            sellerId?: string;
            vendorId?: string;
            exp?: number;
            metadata?: { role?: string; isSeller?: boolean };
          };

          const now = Math.floor(Date.now() / 1000);
          if (payload.sub && (!payload.exp || payload.exp > now)) {
            const rawRole = payload.role ?? payload.metadata?.role;
            const isSuperAdmin = rawRole === "super_admin";
            const isAdmin = rawRole === "admin";
            const isSellerRole =
              rawRole === "seller" ||
              payload.metadata?.isSeller === true ||
              Boolean(payload.sellerId);

            let role: "admin" | "seller" | "customer" | "super_admin" = "customer";
            if (isSuperAdmin) {
              role = "super_admin";
            } else if (isAdmin) {
              role = "admin";
            } else if (isSellerRole) {
              role = "seller";
            }

            return {
              userId: payload.sub,
              role,
              isSuperAdmin,
              isSeller: isSellerRole,
              canManageSellers: isSellerRole || isSuperAdmin || isAdmin,
              claims: payload as unknown as CustomJwtSessionClaims,
            };
          }
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}
