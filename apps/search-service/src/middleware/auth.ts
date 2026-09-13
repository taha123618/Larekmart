import type { FastifyReply, FastifyRequest } from "fastify";
import Clerk from "@clerk/fastify";
import type { CustomJwtSessionClaims } from "@repo/types";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

export const shouldBeUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { userId } = Clerk.getAuth(request);
  if (!userId) {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "You must be authenticated to access this resource",
      },
    });
  }

  request.userId = userId;
};

export const shouldBeAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const auth = Clerk.getAuth(request);
  if (!auth.userId) {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "You must be authenticated to access this resource",
      },
    });
  }

  const claims = auth.sessionClaims as CustomJwtSessionClaims;
  if (claims?.metadata?.role !== "admin") {
    return reply.status(403).send({
      error: {
        code: "FORBIDDEN",
        message: "Admin privileges required to access this resource",
      },
    });
  }

  request.userId = auth.userId;
};
