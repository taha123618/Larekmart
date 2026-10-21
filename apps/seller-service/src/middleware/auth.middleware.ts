import crypto from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/connection.js";
import { sellers, sellerStaff } from "../db/schema.js";

export function safeTimingCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function isInternalService(request: FastifyRequest): boolean {
  const secret = request.headers["x-internal-secret"];
  if (typeof secret !== "string") return false;
  return safeTimingCompare(secret, env.INTERNAL_SERVICE_SECRET);
}

export function getUserId(request: FastifyRequest): string | null {
  const userId = request.headers["x-user-id"];
  if (typeof userId === "string" && userId.trim().length > 0) {
    return userId.trim();
  }
  return null;
}

export function getUserRole(request: FastifyRequest): string | null {
  const userRole = request.headers["x-user-role"];
  if (typeof userRole === "string") {
    return userRole.trim();
  }
  return null;
}

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  if (!userId) {
    reply.status(401).send({ message: "Authentication required" });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (isInternalService(request)) {
    return;
  }
  const role = getUserRole(request);
  if (role !== "admin") {
    reply.status(403).send({ message: "Admin access required" });
  }
}

export async function requireSellerStaffOrAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (isInternalService(request)) {
    return;
  }
  if (getUserRole(request) === "admin") {
    return;
  }

  const userId = getUserId(request);
  if (!userId) {
    reply.status(401).send({ message: "Authentication required" });
    return;
  }

  const params = request.params as { sellerId?: string };
  const sellerId = params.sellerId;
  if (!sellerId) {
    reply.status(400).send({ message: "Missing seller ID parameter" });
    return;
  }

  // Check if user is primary owner of seller
  const sellerRows = await db
    .select({ primaryUserId: sellers.primaryUserId })
    .from(sellers)
    .where(eq(sellers.id, sellerId))
    .limit(1);

  if (sellerRows.length > 0 && sellerRows[0]?.primaryUserId === userId) {
    return;
  }

  // Check if user is active staff
  const staffRows = await db
    .select({ id: sellerStaff.id, status: sellerStaff.status })
    .from(sellerStaff)
    .where(
      and(
        eq(sellerStaff.sellerId, sellerId),
        eq(sellerStaff.userId, userId),
        eq(sellerStaff.status, "ACTIVE")
      )
    )
    .limit(1);

  if (staffRows.length === 0) {
    reply.status(403).send({ message: "Access forbidden: Not authorized for this seller" });
  }
}
