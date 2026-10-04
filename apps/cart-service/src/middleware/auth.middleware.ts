import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { type CustomJwtSessionClaims, GATEWAY_HEADERS } from "@repo/types";
import { env } from "../config/env.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string | null;
      userRole?: string | null;
      guestToken?: string | null;
    }
  }
}

/**
 * Hybrid authentication middleware:
 * - Checks for trusted API Gateway internal header propagation
 * - Checks for authenticated Clerk session
 * - Fallbacks to anonymous guest token (header 'x-guest-token')
 * - Generates new secure guest token if neither is present
 */
export const resolveCartIdentity = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = req.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as string | undefined;
  const gatewayUserId = req.headers?.[GATEWAY_HEADERS.USER_ID] as string | undefined;
  const gatewayUserRole = req.headers?.[GATEWAY_HEADERS.USER_ROLE] as string | undefined;

  if (
    internalSecret &&
    env.INTERNAL_SERVICE_SECRET &&
    internalSecret === env.INTERNAL_SERVICE_SECRET &&
    gatewayUserId
  ) {
    req.userId = gatewayUserId;
    req.userRole = gatewayUserRole;
    req.guestToken = null;
    return next();
  }

  // 2. Direct Clerk token verification
  try {
    const auth = getAuth(req);
    if (auth && auth.userId) {
      req.userId = auth.userId;
      req.guestToken = null;
      return next();
    }
  } catch {
    // If Clerk auth check fails or is not signed in, fall through to guest resolution
  }

  // Check guest token from headers or query
  const rawToken = req.headers?.["x-guest-token"] || req.query?.["guest_token"];
  const guestToken =
    typeof rawToken === "string" && rawToken.trim().length > 0
      ? rawToken.trim()
      : uuidv4();

  req.userId = null;
  req.guestToken = guestToken;

  // Echo the guest token in the response header so client can store it
  res.setHeader("x-guest-token", guestToken);
  return next();
};

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = req.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as string | undefined;
  const gatewayUserId = req.headers?.[GATEWAY_HEADERS.USER_ID] as string | undefined;
  const gatewayUserRole = req.headers?.[GATEWAY_HEADERS.USER_ROLE] as string | undefined;

  if (
    internalSecret &&
    env.INTERNAL_SERVICE_SECRET &&
    internalSecret === env.INTERNAL_SERVICE_SECRET &&
    gatewayUserId
  ) {
    req.userId = gatewayUserId;
    req.userRole = gatewayUserRole;
    return next();
  }

  // 2. Direct Clerk token verification
  const auth = getAuth(req);
  if (!auth || !auth.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  req.userId = auth.userId;
  return next();
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = req.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as string | undefined;
  const gatewayUserId = req.headers?.[GATEWAY_HEADERS.USER_ID] as string | undefined;
  const gatewayUserRole = req.headers?.[GATEWAY_HEADERS.USER_ROLE] as string | undefined;

  if (
    internalSecret &&
    env.INTERNAL_SERVICE_SECRET &&
    internalSecret === env.INTERNAL_SERVICE_SECRET &&
    gatewayUserId
  ) {
    if (gatewayUserRole !== "admin") {
      res.status(403).json({ message: "Administrator role required" });
      return;
    }
    req.userId = gatewayUserId;
    req.userRole = gatewayUserRole;
    return next();
  }

  // 2. Direct Clerk token verification
  const auth = getAuth(req);
  if (!auth || !auth.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const claims = auth.sessionClaims as CustomJwtSessionClaims;
  if (claims?.metadata?.role !== "admin") {
    res.status(403).json({ message: "Administrator role required" });
    return;
  }

  req.userId = auth.userId;
  return next();
};
