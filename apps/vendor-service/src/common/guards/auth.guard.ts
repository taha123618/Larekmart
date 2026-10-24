import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

export interface AuthenticatedUser {
  userId: string;
  role: string;
  email?: string;
  isSeller?: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const userId = request.headers["x-user-id"] as string | undefined;
    const role =
      (request.headers["x-user-role"] as string | undefined) || "user";
    const email = request.headers["x-user-email"] as string | undefined;
    const isSeller = request.headers["x-user-is-seller"] === "true";

    if (!userId) {
      throw new UnauthorizedException(
        "Authentication required: Missing x-user-id header",
      );
    }

    request.user = {
      userId,
      role,
      email,
      isSeller,
    };

    return true;
  }
}
