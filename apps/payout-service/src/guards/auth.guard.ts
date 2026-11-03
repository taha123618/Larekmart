import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { env } from "../config/env.js";
import crypto from "crypto";

@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedSecret = request.headers["x-internal-secret"];

    if (!providedSecret || typeof providedSecret !== "string") {
      throw new UnauthorizedException("Missing internal service secret");
    }

    const expectedBuffer = Buffer.from(env.INTERNAL_SERVICE_SECRET);
    const providedBuffer = Buffer.from(providedSecret);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException("Invalid internal service secret");
    }

    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userRole = request.headers["x-user-role"];

    if (userRole !== "admin") {
      throw new ForbiddenException("Administrative access required");
    }

    return true;
  }
}

@Injectable()
export class SellerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers["x-user-id"] || request.headers["x-seller-id"];

    if (!userId) {
      // In development or test, allow a fallback if header is absent
      if (env.NODE_ENV !== "production") {
        request.sellerId = "seller_dev_mock";
        return true;
      }
      throw new UnauthorizedException("Authentication required");
    }

    request.sellerId = String(userId);
    return true;
  }
}
