import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import { isInternalService } from "./admin.guard.js";

@Injectable()
export class ManageAdminGuard implements CanActivate {
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
    const isSuper =
      role === "super_admin" ||
      request.headers["x-user-is-super-admin"] === "true";
    const canManage = request.headers["x-user-can-manage-sellers"] === "true";

    if (isSuper || canManage || (isInternal && !role)) {
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
