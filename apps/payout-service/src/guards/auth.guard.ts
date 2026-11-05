import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { env } from "../config/env.js";
import crypto from "node:crypto";

/**
 * Constant-time comparison using SHA-256 hash digests to prevent timing attacks
 * and secret length leakage.
 */
export function safeTimingCompare(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  try {
    const hashA = crypto.createHash("sha256").update(a).digest();
    const hashB = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  } catch {
    return false;
  }
}

export function isInternalService(request: {
  headers: Record<string, unknown>;
}): boolean {
  const secret = request.headers["x-internal-secret"];
  if (typeof secret !== "string") return false;
  return safeTimingCompare(secret, env.INTERNAL_SERVICE_SECRET);
}

@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedSecret = request.headers["x-internal-secret"];

    if (!providedSecret || typeof providedSecret !== "string") {
      throw new UnauthorizedException("Missing internal service secret");
    }

    if (!safeTimingCompare(providedSecret, env.INTERNAL_SERVICE_SECRET)) {
      throw new UnauthorizedException("Invalid internal service secret");
    }

    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const isInternal = isInternalService(request);
    const isDevOrTest =
      env.NODE_ENV === "development" || env.NODE_ENV === "test";

    // In production, caller identity must arrive through trusted gateway
    if (!isInternal && !isDevOrTest) {
      throw new ForbiddenException(
        "Invalid or missing internal service secret",
      );
    }

    const userRole = request.headers["x-user-role"];
    const userId = request.headers["x-user-id"];

    // Zero-Trust: If user identity is present, user must strictly possess admin role
    if (userRole !== undefined || userId !== undefined) {
      if (userRole === "admin") {
        return true;
      }
      throw new ForbiddenException("Administrative access required");
    }

    // Pure machine-to-machine internal call with no user identity
    if (isInternal) {
      return true;
    }

    throw new ForbiddenException("Administrative access required");
  }
}

@Injectable()
export class SellerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const isInternal = isInternalService(request);
    const isDevOrTest =
      env.NODE_ENV === "development" || env.NODE_ENV === "test";

    if (!isInternal && !isDevOrTest) {
      throw new UnauthorizedException(
        "Invalid or missing internal service secret",
      );
    }

    const userId = request.headers["x-user-id"] as string | undefined;
    const isSeller = request.headers["x-user-is-seller"] === "true";
    const userRole = request.headers["x-user-role"] as string | undefined;

    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      throw new UnauthorizedException(
        "Authentication required: Missing user identity",
      );
    }

    // Zero-Trust: Non-seller customer roles strictly forbidden from merchant balance & payout extraction
    if (
      userRole &&
      userRole !== "seller" &&
      userRole !== "admin" &&
      !isSeller
    ) {
      throw new ForbiddenException("Seller or administrator role required");
    }

    // In production, caller must explicitly possess verified seller or admin authority
    if (
      env.NODE_ENV === "production" &&
      !isSeller &&
      userRole !== "seller" &&
      userRole !== "admin"
    ) {
      throw new ForbiddenException("Seller authorization required");
    }

    request.sellerId = String(userId).trim();
    return true;
  }
}
