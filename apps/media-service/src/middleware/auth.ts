import crypto from "node:crypto";
import { getAuth } from "@hono/clerk-auth";
import { createMiddleware } from "hono/factory";
import { type CustomJwtSessionClaims, GATEWAY_HEADERS } from "@repo/types";
import { env } from "../config/env.js";
import type { MediaActor } from "../services/media.service.js";

export type AuthVariables = {
  userId: string;
  mediaActor: MediaActor;
};

function safeTimingCompare(a: string, b: string): boolean {
  try {
    const hashA = crypto.createHash("sha256").update(a).digest();
    const hashB = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  } catch {
    return false;
  }
}

/**
 * Authentication: Clerk everywhere (repo golden rule). Derives the verified
 * userId from session claims — never from client-supplied headers or body.
 * Also supports trusted API Gateway internal header propagation.
 *
 * MEDIA_DEV_AUTH_BYPASS=true permits local testing without Clerk keys by
 * trusting x-user-id/x-user-role headers. The env module hard-fails startup
 * if that flag is set with NODE_ENV=production.
 */
export const shouldBeUser = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    // 1. Fast-path: Check trusted API Gateway internal header propagation
    const internalSecret = c.req.header(GATEWAY_HEADERS.INTERNAL_SECRET);
    const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
    const gatewayUserId = c.req.header(GATEWAY_HEADERS.USER_ID);
    const gatewayUserRole = c.req.header(GATEWAY_HEADERS.USER_ROLE);

    if (
      internalSecret &&
      configuredSecret &&
      safeTimingCompare(internalSecret, configuredSecret) &&
      gatewayUserId
    ) {
      const role = gatewayUserRole === "admin" ? "admin" : "user";
      c.set("userId", gatewayUserId);
      c.set("mediaActor", { userId: gatewayUserId, role });
      await next();
      return;
    }

    if (env.isDevAuthBypass) {
      const userId = c.req.header("x-user-id");
      if (!userId) {
        return c.json(
          { message: "x-user-id header required in dev bypass mode" },
          401,
        );
      }
      const role = c.req.header("x-user-role") === "admin" ? "admin" : "user";
      c.set("userId", userId);
      c.set("mediaActor", { userId, role });
      await next();
      return;
    }

    let auth: ReturnType<typeof getAuth> | null = null;
    try {
      auth = getAuth(c);
    } catch {
      auth = null;
    }

    if (!auth?.userId) {
      return c.json({ message: "You are not logged in." }, 401);
    }

    const claims = auth.sessionClaims as CustomJwtSessionClaims | null;
    const role = claims?.metadata?.role === "admin" ? "admin" : "user";

    c.set("userId", auth.userId);
    c.set("mediaActor", { userId: auth.userId, role });
    await next();
  },
);

export const shouldBeAdmin = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    // 1. Fast-path: Check trusted API Gateway internal header propagation
    const internalSecret = c.req.header(GATEWAY_HEADERS.INTERNAL_SECRET);
    const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
    const gatewayUserId = c.req.header(GATEWAY_HEADERS.USER_ID);
    const gatewayUserRole = c.req.header(GATEWAY_HEADERS.USER_ROLE);

    if (
      internalSecret &&
      configuredSecret &&
      safeTimingCompare(internalSecret, configuredSecret) &&
      gatewayUserId
    ) {
      if (gatewayUserRole !== "admin") {
        return c.json({ message: "Admin access required" }, 403);
      }
      c.set("userId", gatewayUserId);
      c.set("mediaActor", { userId: gatewayUserId, role: "admin" });
      await next();
      return;
    }

    if (env.isDevAuthBypass) {
      const userId = c.req.header("x-user-id");
      const role = c.req.header("x-user-role");
      if (!userId || role !== "admin") {
        return c.json({ message: "Admin access required" }, 403);
      }
      c.set("userId", userId);
      c.set("mediaActor", { userId, role: "admin" });
      await next();
      return;
    }

    let auth: ReturnType<typeof getAuth> | null = null;
    try {
      auth = getAuth(c);
    } catch {
      auth = null;
    }

    if (!auth?.userId) {
      return c.json({ message: "You are not logged in." }, 401);
    }

    const claims = auth.sessionClaims as CustomJwtSessionClaims | null;
    if (claims?.metadata?.role !== "admin") {
      return c.json({ message: "Unauthorized!" }, 403);
    }

    c.set("userId", auth.userId);
    c.set("mediaActor", { userId: auth.userId, role: "admin" });
    await next();
  },
);

/** Builds an actor for unauthenticated public reads (no PRIVATE access). */
export function publicActor(): MediaActor | null {
  return null;
}
