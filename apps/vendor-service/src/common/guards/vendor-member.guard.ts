import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { PrismaService } from "../../database/prisma.service.js";

@Injectable()
export class VendorMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const userId = request.headers["x-user-id"] as string | undefined;
    const role = request.headers["x-user-role"] as string | undefined;
    const params = request.params as { vendorId?: string };
    const vendorId = params.vendorId;

    if (!userId) {
      throw new ForbiddenException("Authentication required");
    }

    if (role === "admin") {
      return true;
    }

    if (!vendorId) {
      return true;
    }

    // Check membership or owner
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
  }
}
