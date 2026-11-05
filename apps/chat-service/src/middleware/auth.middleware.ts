import crypto from "crypto";
import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

export interface AuthenticatedUser {
  userId: string;
  role: string;
  email?: string;
  isSeller: boolean;
  isAdmin: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    isInternalService?: boolean;
  }
}

/**
 * Constant-time string comparison using SHA-256 digest buffers
 * to eliminate timing attack vulnerabilities on secret verification.
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

/**
 * Verifies user authentication from gateway-forwarded identity claims or direct Bearer tokens.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const isDevOrTest = env.NODE_ENV === "development" || env.NODE_ENV === "test";
  const internalSecret = request.headers["x-internal-secret"] as string | undefined;
  const isInternal = safeTimingCompare(internalSecret, env.INTERNAL_SERVICE_SECRET);
  request.isInternalService = isInternal;

  // In production, user identity must arrive through trusted gateway perimeter
  if (!isInternal && !isDevOrTest) {
    reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid or missing internal service secret",
    });
    return;
  }

  const userId = request.headers["x-user-id"] as string | undefined;
  const userRole = (request.headers["x-user-role"] as string) || "user";
  const userEmail = request.headers["x-user-email"] as string | undefined;
  const isSeller =
    request.headers["x-user-is-seller"] === "true" || userRole === "seller";
  const isAdmin =
    userRole === "admin" ||
    userRole === "super_admin" ||
    request.headers["x-user-is-super-admin"] === "true";

  // Machine-to-machine calls with verified internal secret and no user identity
  if (isInternal && !userId) {
    request.user = {
      userId: "system_internal_service",
      role: "system",
      isSeller: true,
      isAdmin: true,
    };
    return;
  }

  if (!userId) {
    reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Missing authenticated user credentials (x-user-id header)",
    });
    return;
  }

  request.user = {
    userId,
    role: userRole,
    email: userEmail,
    isSeller,
    isAdmin,
  };
}

/**
 * Restricts access strictly to administrative personnel.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (!request.user?.isAdmin) {
    reply.status(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Administrator access required for this endpoint",
    });
  }
}
