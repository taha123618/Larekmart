import crypto from "node:crypto";
import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { type CustomJwtSessionClaims, GATEWAY_HEADERS } from "@repo/types";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

function safeTimingCompare(a: string, b: string): boolean {
  try {
    const hashA = crypto.createHash("sha256").update(a).digest();
    const hashB = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  } catch {
    return false;
  }
}

export const shouldBeUser = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = req.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as
    | string
    | undefined;
  const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
  const gatewayUserId = req.headers?.[GATEWAY_HEADERS.USER_ID] as
    | string
    | undefined;
  const gatewayUserRole = req.headers?.[GATEWAY_HEADERS.USER_ROLE] as
    | string
    | undefined;

  if (
    internalSecret &&
    configuredSecret &&
    safeTimingCompare(internalSecret, configuredSecret) &&
    gatewayUserId
  ) {
    req.userId = gatewayUserId;
    req.userRole = gatewayUserRole;
    return next();
  }

  // 2. Fallback: Direct Clerk token verification
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    return res.status(401).json({ message: "You are not logged in!" });
  }

  req.userId = auth.userId;
  return next();
};

export const shouldBeAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = req.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as
    | string
    | undefined;
  const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
  const gatewayUserId = req.headers?.[GATEWAY_HEADERS.USER_ID] as
    | string
    | undefined;
  const gatewayUserRole = req.headers?.[GATEWAY_HEADERS.USER_ROLE] as
    | string
    | undefined;

  if (
    internalSecret &&
    configuredSecret &&
    safeTimingCompare(internalSecret, configuredSecret) &&
    gatewayUserId
  ) {
    if (gatewayUserRole !== "admin") {
      return res.status(403).json({ message: "Unauthorized!" });
    }
    req.userId = gatewayUserId;
    req.userRole = gatewayUserRole;
    return next();
  }

  // 2. Fallback: Direct Clerk token verification
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    return res.status(401).json({ message: "You are not logged in!" });
  }

  const claims = auth.sessionClaims as CustomJwtSessionClaims;

  if (claims?.metadata?.role !== "admin") {
    return res.status(403).json({ message: "Unauthorized!" });
  }

  req.userId = auth.userId;
  return next();
};

export const shouldBeSellerOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = req.headers?.[GATEWAY_HEADERS.INTERNAL_SECRET] as
    | string
    | undefined;
  const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
  const gatewayUserId = req.headers?.[GATEWAY_HEADERS.USER_ID] as
    | string
    | undefined;
  const gatewayUserRole = req.headers?.[GATEWAY_HEADERS.USER_ROLE] as
    | string
    | undefined;

  if (
    internalSecret &&
    configuredSecret &&
    safeTimingCompare(internalSecret, configuredSecret) &&
    gatewayUserId
  ) {
    if (gatewayUserRole !== "admin" && gatewayUserRole !== "seller") {
      return res
        .status(403)
        .json({ message: "Seller or Admin role required!" });
    }
    req.userId = gatewayUserId;
    req.userRole = gatewayUserRole;
    return next();
  }

  // 2. Fallback: Direct Clerk token verification
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    return res.status(401).json({ message: "You are not logged in!" });
  }

  const claims = auth.sessionClaims as CustomJwtSessionClaims;
  const role = claims?.metadata?.role;

  if (role !== "admin" && role !== "seller") {
    return res.status(403).json({ message: "Seller or Admin role required!" });
  }

  req.userId = auth.userId;
  req.userRole = role;
  return next();
};
