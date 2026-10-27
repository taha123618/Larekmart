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
        if (role && role !== "admin") {
          ctx.status = 403;
          ctx.body = { message: "Administrator privileges required" };
          return;
        }
        ctx.state.userId = ctx.headers["x-user-id"] || "internal";
        ctx.state.userRole = typeof role === "string" ? role : "admin";
        return next();
      }
    } catch {
      // Fall through to authentication
    }
  }

  const authHeader = ctx.headers["authorization"] as string | undefined;
  const currentEnv = process.env.NODE_ENV || env.NODE_ENV;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (currentEnv === "development" && !internalSecret) {
      return next(); // Permissive in dev if no secret configured
    }
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
      const clerkSecret = process.env.CLERK_SECRET_KEY;
      const key = jwtKey || clerkSecret;
      const isProduction =
        (process.env.NODE_ENV || env.NODE_ENV) === "production";

      // If a signing key is configured, verify signature cryptographically
      if (key) {
        const signedData = `${parts[0]}.${parts[1]}`;
        const signature = Buffer.from(parts[2]!, "base64url");

        let verified = false;
        if (key.includes("-----BEGIN")) {
          try {
            const verifier = crypto.createVerify("RSA-SHA256");
            verifier.update(signedData);
            verified = verifier.verify(key, signature);
          } catch {
            verified = false;
          }
        } else {
          try {
            const expectedSig = crypto
              .createHmac("sha256", key)
              .update(signedData)
              .digest();
            verified =
              signature.length === expectedSig.length &&
              crypto.timingSafeEqual(signature, expectedSig);
          } catch {
            verified = false;
          }
        }

        if (!verified) {
          ctx.status = 401;
          ctx.body = { message: "Invalid or tampered token signature" };
          return;
        }
      } else if (isProduction) {
        ctx.status = 401;
        ctx.body = {
          message: "Cryptographic signing key required in production",
        };
        return;
      }

      const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
      const claims = JSON.parse(payloadJson);
      const role = claims?.metadata?.role || claims?.role;

      if (role === "admin") {
        ctx.state.userId = claims?.sub;
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
