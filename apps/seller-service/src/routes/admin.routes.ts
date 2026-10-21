import type { FastifyPluginAsync } from "fastify";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { db } from "../db/connection.js";
import {
  sellers,
  sellerStores,
  sellerStatusHistory,
  sellerPerformanceSnapshots,
} from "../db/schema.js";
import { requireAdmin, getUserId } from "../middleware/auth.middleware.js";
import { sellerEventProducer } from "../kafka/producer.js";

const SuspendSellerSchema = z.object({
  reason: z.string().min(3),
});

export const adminSellerRoutes: FastifyPluginAsync = async (app) => {
  // 1. List all marketplace sellers (Admin only)
  app.get(
    "/api/v1/admin/sellers",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const allSellers = await db
        .select({
          id: sellers.id,
          vendorId: sellers.vendorId,
          primaryUserId: sellers.primaryUserId,
          status: sellers.status,
          createdAt: sellers.createdAt,
          storeName: sellerStores.name,
          slug: sellerStores.slug,
          vacationMode: sellerStores.vacationMode,
        })
        .from(sellers)
        .leftJoin(sellerStores, eq(sellers.id, sellerStores.sellerId))
        .orderBy(desc(sellers.createdAt));

      return reply.send(allSellers);
    }
  );

  // 2. Activate a seller account
  app.post(
    "/api/v1/admin/sellers/:sellerId/activate",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const adminId = getUserId(request) || "system-admin";

      const sellerRows = await db
        .select()
        .from(sellers)
        .where(eq(sellers.id, sellerId))
        .limit(1);

      if (sellerRows.length === 0) {
        return reply.status(404).send({ message: "Seller not found" });
      }

      const prevStatus = sellerRows[0]!.status;
      await db
        .update(sellers)
        .set({ status: "ACTIVE", updatedAt: new Date() })
        .where(eq(sellers.id, sellerId));

      await db.insert(sellerStatusHistory).values({
        id: `h_${uuidv4()}`,
        sellerId,
        previousStatus: prevStatus,
        newStatus: "ACTIVE",
        reason: "Activated by Marketplace Administrator",
        changedByUserId: adminId,
      });

      await sellerEventProducer.publishSellerActivated({
        sellerId,
        vendorId: sellerRows[0]!.vendorId,
        activatedAt: new Date().toISOString(),
        activatedByUserId: adminId,
      });

      return reply.send({ sellerId, status: "ACTIVE" });
    }
  );

  // 3. Suspend a seller account
  app.post(
    "/api/v1/admin/sellers/:sellerId/suspend",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const adminId = getUserId(request) || "system-admin";
      const body = SuspendSellerSchema.parse(request.body);

      const sellerRows = await db
        .select()
        .from(sellers)
        .where(eq(sellers.id, sellerId))
        .limit(1);

      if (sellerRows.length === 0) {
        return reply.status(404).send({ message: "Seller not found" });
      }

      const prevStatus = sellerRows[0]!.status;
      await db
        .update(sellers)
        .set({ status: "SUSPENDED", updatedAt: new Date() })
        .where(eq(sellers.id, sellerId));

      await db.insert(sellerStatusHistory).values({
        id: `h_${uuidv4()}`,
        sellerId,
        previousStatus: prevStatus,
        newStatus: "SUSPENDED",
        reason: body.reason,
        changedByUserId: adminId,
      });

      await sellerEventProducer.publishSellerSuspended({
        sellerId,
        vendorId: sellerRows[0]!.vendorId,
        reason: body.reason,
        suspendedAt: new Date().toISOString(),
        suspendedByUserId: adminId,
      });

      return reply.send({ sellerId, status: "SUSPENDED", reason: body.reason });
    }
  );
};
