import crypto from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

/**
 * Constant-time comparison using SHA-256 hash digests to prevent timing attacks
 */
export function safeTimingCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Validates internal service secret provided by API Gateway or internal microservices
 */
export function isInternalService(request: FastifyRequest): boolean {
  const secret = request.headers["x-internal-secret"];
  if (typeof secret !== "string") {
    return false;
  }
  return safeTimingCompare(secret, env.INTERNAL_SERVICE_SECRET);
}

/**
 * Guard requiring either internal service secret or admin session claims.
 * Enforces Zero-Trust: If user context headers (x-user-role or x-user-id) are present,
 * access is only granted if the user possesses the admin role and is routed via a trusted context.
 * Internal service secrets alone NEVER bypass admin authorization when acting on behalf of a user.
 */
export async function requireAdminOrInternal(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const isInternal = isInternalService(request);
  const userRole = request.headers["x-user-role"] as string | undefined;
  const userId = request.headers["x-user-id"] as string | undefined;

  // Zero-Trust: Proxied user requests with user identity headers must strictly have admin role
  if (userRole !== undefined || userId !== undefined) {
    if (userRole === "admin" && isInternal) {
      return;
    }
    reply
      .status(403)
      .send({ message: "Forbidden: Admin or internal access required" });
    return;
  }

  // Pure machine-to-machine internal service call (no user context)
  if (isInternal) {
    return;
  }

  // Direct Clerk auth session claims verification (e.g., during direct/ingress calls)
  const auth = (
    request as unknown as {
      auth?: { sessionClaims?: { metadata?: { role?: string } } };
    }
  ).auth;
  if (auth?.sessionClaims?.metadata?.role === "admin") {
    return;
  }

  reply
    .status(403)
    .send({ message: "Forbidden: Admin or internal access required" });
}

/**
 * Middleware for sensitive operations requiring internal microservice authentication
 */
export async function requireInternal(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isInternalService(request)) {
    reply
      .status(401)
      .send({ message: "Unauthorized: Invalid or missing internal secret" });
  }
}
