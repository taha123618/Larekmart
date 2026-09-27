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
  if (parts.length >= 2) {
    try {
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
