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
 * Guard requiring either internal service secret or admin session claims
 */
export async function requireAdminOrInternal(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (isInternalService(request)) {
    return;
  }

  // Check Clerk auth session claims if available
  const auth = (
    request as unknown as {
      auth?: { sessionClaims?: { metadata?: { role?: string } } };
    }
  ).auth;
  if (auth?.sessionClaims?.metadata?.role === "admin") {
    return;
  }

  // Also check role header forwarded by trusted API Gateway
  const userRole = request.headers["x-user-role"];
  if (userRole === "admin" && isInternalService(request)) {
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
