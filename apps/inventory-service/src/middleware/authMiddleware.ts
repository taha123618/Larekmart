import crypto from "node:crypto";
import { getAuth } from "@hono/clerk-auth";
import { createMiddleware } from "hono/factory";
import { type CustomJwtSessionClaims, GATEWAY_HEADERS } from "@repo/types";

export type AuthVariables = {
  userId: string;
  userRole?: string;
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
      c.set("userId", gatewayUserId);
      c.set("userRole", gatewayUserRole);
      await next();
      return;
    }

    // 2. Direct Clerk token verification
    const auth = getAuth(c);
    if (!auth?.userId) {
      return c.json({ message: "You are not logged in." }, 401);
    }

    c.set("userId", auth.userId);
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
        return c.json({ message: "Unauthorized!" }, 403);
      }
      c.set("userId", gatewayUserId);
      c.set("userRole", gatewayUserRole);
      await next();
      return;
    }

    // 2. Direct Clerk token verification
    const auth = getAuth(c);
    if (!auth?.userId) {
      return c.json({ message: "You are not logged in." }, 401);
    }

    const claims = auth.sessionClaims as CustomJwtSessionClaims;
    if (claims.metadata?.role !== "admin") {
      return c.json({ message: "Unauthorized!" }, 403);
    }

    c.set("userId", auth.userId);
    await next();
  },
);
