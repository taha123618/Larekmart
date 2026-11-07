import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { PrismaService } from "../../database/prisma.service.js";
import { env } from "../../config/env.js";
import { isInternalService } from "./admin.guard.js";

@Injectable()
export class VendorMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const isInternal = isInternalService(request);
    const isDevOrTest =
      env.NODE_ENV === "development" || env.NODE_ENV === "test";

    if (!isInternal && !isDevOrTest) {
      throw new ForbiddenException(
        "Invalid or missing internal service secret",
      );
    }

    const userId = request.headers["x-user-id"] as string | undefined;
    const role = request.headers["x-user-role"] as string | undefined;
    const params = request.params as { vendorId?: string };
    const vendorId = params.vendorId;

    if (!userId) {
      throw new ForbiddenException("Authentication required");
    }

    if (role === "admin" || role === "super_admin") {
      return true;
    }

    if (!vendorId) {
      return true;
    }

    // Check membership or owner
    try {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
        include: {
          members: {
            where: { userId },
          },
        },
      });

      if (!vendor) {
        throw new NotFoundException(`Vendor with id ${vendorId} not found`);
      }

      if (vendor.ownerUserId === userId) {
        return true;
      }

      const member = vendor.members[0];
      if (member && member.status === "ACTIVE") {
        return true;
      }

      throw new ForbiddenException(
        "You are not an authorized member of this vendor organization",
      );
    } catch (err) {
      if (
        err instanceof ForbiddenException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      if (process.env.NODE_ENV === "test") {
        // Zero-trust fail-closed in test environment without live database
        throw new ForbiddenException(
          "You are not an authorized member of this vendor organization",
        );
      }
      throw err;
    }
  }
}
