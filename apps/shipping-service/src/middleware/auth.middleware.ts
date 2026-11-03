import crypto from "node:crypto";
import type { Context, Next } from "koa";
import { env } from "../config/env.js";

/**
 * Middleware ensuring shipment mutations and administrative queries
 * require verified administrator authorization or a valid internal service secret.
 */
export async function requireAdminOrInternal(
  ctx: Context,
  next: Next,
): Promise<void> {
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
  const providedSecret =
    ctx.headers["x-internal-secret"] || ctx.headers["X-Internal-Secret"];

  if (internalSecret && typeof providedSecret === "string") {
    try {
      const hashProvided = crypto
        .createHash("sha256")
        .update(providedSecret)
        .digest();
      const hashInternal = crypto
        .createHash("sha256")
        .update(internalSecret)
        .digest();
      if (crypto.timingSafeEqual(hashProvided, hashInternal)) {
        const role = ctx.headers["x-user-role"] || ctx.headers["X-User-Role"];
        const userId = ctx.headers["x-user-id"] || ctx.headers["X-User-Id"];

        // A proxied user request (identity header present) must be an admin.
        // The gateway transport secret never escalates a user to admin.
        if (userId && role !== "admin") {
          ctx.status = 403;
          ctx.body = { message: "Administrator privileges required" };
          return;
        }
        if (role && role !== "admin") {
          ctx.status = 403;
          ctx.body = { message: "Administrator privileges required" };
          return;
        }

        // Pure machine-to-machine call: no user identity is asserted.
        ctx.state.userId =
          typeof userId === "string" ? userId : "internal-service";
        ctx.state.userRole =
          typeof role === "string" ? role : "internal-service";
        return next();
      }
    } catch {
      // Fall through to authentication
    }
  }

  const authHeader = ctx.headers["authorization"] as string | undefined;
  const currentEnv = process.env.NODE_ENV || env.NODE_ENV;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.status = 401;
    ctx.body = {
      message: "Authentication required: missing or invalid Bearer token",
    };
    return;
  }

  const token = authHeader.substring(7).trim();
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const jwtKey = process.env.CLERK_JWT_KEY;
      // The Clerk secret key is NOT an HMAC signing key. Only an explicit
      // HS256 key (tests/local fixtures) may be used for symmetric checks.
      const hmacKey = process.env.CLERK_JWT_HMAC_KEY;
      const isProduction = currentEnv === "production";
      const isTest = currentEnv === "test";

      const signedData = `${parts[0]}.${parts[1]}`;
      const signature = Buffer.from(parts[2]!, "base64url");
      let verified = false;

      if (jwtKey && jwtKey.includes("-----BEGIN")) {
        try {
          const verifier = crypto.createVerify("RSA-SHA256");
          verifier.update(signedData);
          verified = verifier.verify(jwtKey, signature);
        } catch {
          verified = false;
        }
      } else if (hmacKey) {
        try {
          const expectedSig = crypto
            .createHmac("sha256", hmacKey)
            .update(signedData)
            .digest();
          verified =
            signature.length === expectedSig.length &&
            crypto.timingSafeEqual(signature, expectedSig);
        } catch {
          verified = false;
        }
      } else if (!isTest) {
        // Fail closed in production AND development when no key is configured.
        ctx.status = 401;
        ctx.body = {
          message: "Cryptographic signing key required to verify tokens",
        };
        return;
      }

      if ((jwtKey || hmacKey) && !verified) {
        ctx.status = 401;
        ctx.body = { message: "Invalid or tampered token signature" };
        return;
      }

      const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
      const claims = JSON.parse(payloadJson) as {
        sub?: string;
        exp?: number;
        nbf?: number;
        role?: string;
        metadata?: { role?: string };
      };
      const now = Math.floor(Date.now() / 1000);

      if (typeof claims.exp !== "number" || claims.exp <= now) {
        ctx.status = 401;
        ctx.body = { message: "Token is missing an expiry or has expired" };
        return;
      }
      if (typeof claims.nbf === "number" && claims.nbf > now + 30) {
        ctx.status = 401;
        ctx.body = { message: "Token is not yet valid" };
        return;
      }

      const role = claims.metadata?.role || claims.role;
      if (role === "admin") {
        ctx.state.userId = claims.sub;
        ctx.state.userRole = role;
        return next();
      }
    } catch {
      // Fall through to 403
    }
  }

  ctx.status = 403;
  ctx.body = { message: "Administrator privileges required" };
}
