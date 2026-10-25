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

export function isSuperAdmin(request: FastifyRequest): boolean {
  if (isInternalService(request)) return true;
  const role = getUserRole(request);
  const isSuper = request.headers["x-user-is-super-admin"] === "true";
  return role === "super_admin" || isSuper;
}

export function isSeller(request: FastifyRequest): boolean {
  if (isInternalService(request) || isSuperAdmin(request)) return true;
  const role = getUserRole(request);
  const isSellerFlag = request.headers["x-user-is-seller"] === "true";
  return isSellerFlag || role === "seller" || role === "admin";
}

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  if (!userId) {
    reply.status(401).send({ message: "Authentication required" });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (isInternalService(request)) {
    return;
  }
  const role = getUserRole(request);
  if (role !== "admin" && role !== "super_admin" && !isSuperAdmin(request)) {
    reply.status(403).send({ message: "Admin access required" });
  }
}

export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isSuperAdmin(request)) {
    reply.status(403).send({
      message: "Super Admin privileges required to manage marketplace settings",
      code: "SUPER_ADMIN_REQUIRED",
    });
  }
}

export function isManageAdmin(request: FastifyRequest): boolean {
  if (isInternalService(request) || isSuperAdmin(request)) return true;
  return request.headers["x-user-can-manage-sellers"] === "true";
}

export async function requireManageAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isManageAdmin(request)) {
    reply.status(403).send({
      message:
        "Super Admin or delegated Manage Admin access required for seller verification",
      code: "MANAGE_ADMIN_REQUIRED",
    });
  }
}

export async function requireSellerQualification(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isSeller(request)) {
    reply.status(403).send({
      message:
        "User is not authorized as a seller (isSeller qualification required)",
      code: "SELLER_NOT_AUTHORIZED",
    });
  }
}

export async function requireSellerEnabled(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Allow internal service calls and super admin operations through
  if (isInternalService(request) || isSuperAdmin(request)) {
    return;
  }

  const { settingsService } = await import("../services/settings.service.js");
  const isEnabled = await settingsService.isSellerFeatureEnabled();
  if (!isEnabled) {
    reply.status(403).send({
      message:
        "Seller and vendor functionality is currently disabled by the platform administrator.",
      code: "SELLER_FEATURE_DISABLED",
    });
  }
}

export async function requireSellerStaffOrAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
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
        eq(sellerStaff.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (staffRows.length === 0) {
    reply
      .status(403)
      .send({ message: "Access forbidden: Not authorized for this seller" });
  }
}
