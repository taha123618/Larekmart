import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { env } from "../../config/env.js";

@Injectable()
export class ManageAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const role = request.headers["x-user-role"] as string | undefined;
    const isSuper =
      role === "super_admin" ||
      request.headers["x-user-is-super-admin"] === "true";
    const canManage = request.headers["x-user-can-manage-sellers"] === "true";
    const internalSecret = request.headers["x-internal-secret"] as
      | string
      | undefined;

    if (
      isSuper ||
      canManage ||
      (internalSecret && internalSecret === env.GATEWAY_INTERNAL_SECRET)
    ) {
      return true;
    }

    throw new ForbiddenException({
      statusCode: 403,
      code: "MANAGE_ADMIN_REQUIRED",
      message:
        "Super Admin or delegated Manage Admin access required for vendor verification",
    });
  }
}
