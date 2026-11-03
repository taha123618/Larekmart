import type { FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { env } from "../config/env.js";

/**
 * Constant-time comparison using SHA-256 hash digests to prevent timing attacks
 * and secret length leakage.
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
 * Validates internal service secret provided by API Gateway or internal microservices.
 */
export function isInternalService(request: FastifyRequest): boolean {
  const secret = request.headers["x-internal-secret"];
  if (typeof secret !== "string") {
    return false;
  }
  return safeTimingCompare(secret, env.INTERNAL_SERVICE_SECRET);
}

/**
 * Guard requiring a valid internal service secret header.
 */
export async function requireInternalSecret(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const secret = request.headers["x-internal-secret"];
  if (typeof secret !== "string") {
    reply.status(401).send({ message: "Missing x-internal-secret header" });
    return;
  }

  if (!safeTimingCompare(secret, env.INTERNAL_SERVICE_SECRET)) {
    reply.status(403).send({ message: "Invalid internal service secret" });
    return;
  }
}

/**
 * Guard requiring administrative privileges.
 * Enforces Zero-Trust: If user context headers (x-user-role or x-user-id) are present,
 * access is only granted if the user possesses the admin role.
 * Internal service secrets alone NEVER bypass admin authorization when acting on behalf of a user.
 * Pure machine-to-machine internal service calls (no user context) are permitted with a valid secret.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const isInternal = isInternalService(request);
  const userRole = request.headers["x-user-role"] as string | undefined;
  const userId = request.headers["x-user-id"] as string | undefined;

  // In production, all proxied requests must arrive via trusted internal transport
  if (env.NODE_ENV === "production" && !isInternal) {
    reply
      .status(403)
      .send({ message: "Invalid or missing internal service secret" });
    return;
  }

  // Zero-Trust: If user identity headers are present, caller must strictly possess admin role
  if (userRole !== undefined || userId !== undefined) {
    if (userRole === "admin") {
      return;
    }
    reply.status(403).send({ message: "Admin role required" });
    return;
  }

  // Pure machine-to-machine internal service call (no user context)
  if (isInternal) {
    return;
  }

  reply.status(403).send({ message: "Admin role required" });
}
