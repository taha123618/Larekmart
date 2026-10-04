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

export const shouldBeUser = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // 1. Fast-path: Check trusted API Gateway internal header propagation
  const internalSecret = req.headers[GATEWAY_HEADERS.INTERNAL_SECRET] as string | undefined;
  const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
  const gatewayUserId = req.headers[GATEWAY_HEADERS.USER_ID] as string | undefined;
  const gatewayUserRole = req.headers[GATEWAY_HEADERS.USER_ROLE] as string | undefined;

  if (
    internalSecret &&
    configuredSecret &&
    internalSecret === configuredSecret &&
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
  const internalSecret = req.headers[GATEWAY_HEADERS.INTERNAL_SECRET] as string | undefined;
  const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
  const gatewayUserId = req.headers[GATEWAY_HEADERS.USER_ID] as string | undefined;
  const gatewayUserRole = req.headers[GATEWAY_HEADERS.USER_ROLE] as string | undefined;

  if (
    internalSecret &&
    configuredSecret &&
    internalSecret === configuredSecret &&
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
