import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { env } from "../../config/env.js";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const role = request.headers["x-user-role"] as string | undefined;
    const internalSecret = request.headers["x-internal-secret"] as string | undefined;

    if (role === "admin" || (internalSecret && internalSecret === env.GATEWAY_INTERNAL_SECRET)) {
      return true;
    }

    throw new ForbiddenException("Administrative access required");
  }
}
