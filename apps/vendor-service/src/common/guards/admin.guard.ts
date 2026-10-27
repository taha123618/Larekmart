import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import crypto from "node:crypto";
import type { FastifyRequest } from "fastify";
import { env } from "../../config/env.js";

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

export function isInternalService(request: FastifyRequest): boolean {
  const secret = request.headers["x-internal-secret"] as string | undefined;
  if (!secret) return false;
  return safeTimingCompare(secret, env.GATEWAY_INTERNAL_SECRET);
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const isInternal = isInternalService(request);
    const isDevOrTest =
      env.NODE_ENV === "development" || env.NODE_ENV === "test";

    // In production, caller identity must arrive through trusted gateway
    if (!isInternal && !isDevOrTest) {
      throw new ForbiddenException(
        "Invalid or missing internal service secret",
      );
    }

    const role = request.headers["x-user-role"] as string | undefined;
    const isSuper = request.headers["x-user-is-super-admin"] === "true";

    if (
      role === "admin" ||
      role === "super_admin" ||
      isSuper ||
      (isInternal && !role)
    ) {
      return true;
    }

    throw new ForbiddenException("Administrative access required");
  }
}
