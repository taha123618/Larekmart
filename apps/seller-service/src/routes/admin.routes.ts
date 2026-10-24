import type { FastifyPluginAsync } from "fastify";
import { eq, desc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { db } from "../db/connection.js";
import {
  sellers,
  sellerStores,
  sellerStaff,
  sellerSettings,
  sellerPolicies,
  sellerStatusHistory,
  sellerPerformanceSnapshots,
  adminDelegations,
} from "../db/schema.js";
import {
  requireAdmin,
  requireSuperAdmin,
  requireManageAdmin,
  getUserId,
} from "../middleware/auth.middleware.js";
import { sellerEventProducer } from "../kafka/producer.js";
import { settingsService } from "../services/settings.service.js";
import { UpdateSystemSettingsSchema, GrantDelegationSchema } from "@repo/types";

const SuspendSellerSchema = z.object({
  reason: z.string().min(3),
});

const UpdateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE", "ONBOARDING"]),
  reason: z.string().optional(),
});

export const adminSellerRoutes: FastifyPluginAsync = async (app) => {
  // 1. List all marketplace sellers (Admin only)
  app.get(
    "/api/v1/admin/sellers",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const query = request.query as { status?: string };

      let dbQuery = db
        .select({
          id: sellers.id,
          vendorId: sellers.vendorId,
          primaryUserId: sellers.primaryUserId,
          ownerUserId: sellers.primaryUserId,
          status: sellers.status,
          createdAt: sellers.createdAt,
          updatedAt: sellers.updatedAt,
          storeName: sellerStores.name,
          slug: sellerStores.slug,
          vacationMode: sellerStores.vacationMode,
        })
        .from(sellers)
        .leftJoin(sellerStores, eq(sellers.id, sellerStores.sellerId))
        .orderBy(desc(sellers.createdAt));

      if (query.status && query.status !== "ALL") {
        // @ts-expect-error Drizzle dynamic where condition
        dbQuery = dbQuery.where(eq(sellers.status, query.status));
      }

      const allSellers = await dbQuery;

      return reply.send({
        sellers: allSellers,
        total: allSellers.length,
      });
    },
  );

  // 2. Get single seller details (Admin drawer / view)
  app.get(
    "/api/v1/admin/sellers/:sellerId",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };

      const sellerRows = await db
        .select()
        .from(sellers)
        .where(eq(sellers.id, sellerId))
        .limit(1);

      if (sellerRows.length === 0) {
        return reply.status(404).send({ message: "Seller not found" });
      }

      const [storeRows, settingsRows, policyRows, staffRows, perfRows] =
        await Promise.all([
          db
            .select()
            .from(sellerStores)
            .where(eq(sellerStores.sellerId, sellerId))
            .limit(1),
          db
            .select()
            .from(sellerSettings)
            .where(eq(sellerSettings.sellerId, sellerId))
            .limit(1),
          db
            .select()
            .from(sellerPolicies)
            .where(eq(sellerPolicies.sellerId, sellerId)),
          db
            .select()
            .from(sellerStaff)
            .where(eq(sellerStaff.sellerId, sellerId)),
          db
            .select()
            .from(sellerPerformanceSnapshots)
            .where(eq(sellerPerformanceSnapshots.sellerId, sellerId))
            .orderBy(desc(sellerPerformanceSnapshots.calculatedAt))
            .limit(1),
        ]);

      return reply.send({
        seller: {
          ...sellerRows[0],
          ownerUserId: sellerRows[0]!.primaryUserId,
          store: storeRows[0] || null,
          settings: settingsRows[0] || null,
          policies: policyRows,
          staff: staffRows,
          latestPerformance: perfRows[0] || null,
        },
      });
    },
  );

  // 3. Update seller status (Unified status transition - Super Admin or Manage Admin)
  app.post(
    "/api/v1/admin/sellers/:sellerId/status",
    { preHandler: [requireManageAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const adminId = getUserId(request) || "system-admin";
      const body = UpdateStatusSchema.parse(request.body);

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
        .set({ status: body.status, updatedAt: new Date() })
        .where(eq(sellers.id, sellerId));

      await db.insert(sellerStatusHistory).values({
        id: `h_${uuidv4()}`,
        sellerId,
        previousStatus: prevStatus,
        newStatus: body.status,
        reason: body.reason || `Status updated to ${body.status} by Admin`,
        changedByUserId: adminId,
      });

      if (body.status === "ACTIVE") {
        await sellerEventProducer.publishSellerActivated({
          sellerId,
          vendorId: sellerRows[0]!.vendorId,
          activatedAt: new Date().toISOString(),
          activatedByUserId: adminId,
        });
      } else if (body.status === "SUSPENDED") {
        await sellerEventProducer.publishSellerSuspended({
          sellerId,
          vendorId: sellerRows[0]!.vendorId,
          reason: body.reason || "Suspended by Administrator",
          suspendedAt: new Date().toISOString(),
          suspendedByUserId: adminId,
        });
      }

      await sellerEventProducer.publishSellerUpdated({
        sellerId,
        updatedFields: ["status"],
        updatedAt: new Date().toISOString(),
      });

      const refreshed = await db
        .select()
        .from(sellers)
        .where(eq(sellers.id, sellerId))
        .limit(1);

      return reply.send({
        seller: {
          ...refreshed[0],
          ownerUserId: refreshed[0]!.primaryUserId,
        },
      });
    },
  );

  // 4. Activate a seller account (Super Admin or Manage Admin)
  app.post(
    "/api/v1/admin/sellers/:sellerId/activate",
    { preHandler: [requireManageAdmin] },
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
    },
  );

  // 5. Suspend a seller account (Super Admin or Manage Admin)
  app.post(
    "/api/v1/admin/sellers/:sellerId/suspend",
    { preHandler: [requireManageAdmin] },
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
    },
  );

  // 6. Historical performance metrics
  app.get(
    "/api/v1/admin/sellers/:sellerId/performance",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const query = request.query as { limit?: string };

      const snapshots = await db
        .select()
        .from(sellerPerformanceSnapshots)
        .where(eq(sellerPerformanceSnapshots.sellerId, sellerId))
        .orderBy(desc(sellerPerformanceSnapshots.calculatedAt))
        .limit(Number(query.limit) || 10);

      return reply.send({ snapshots });
    },
  );

  // 7. System Settings — Public status query
  app.get("/api/v1/system-settings", async (_request, reply) => {
    const settings = await settingsService.getSystemSettings();
    return reply.send(settings);
  });

  // 8. System Settings — Admin inspect
  app.get(
    "/api/v1/admin/system-settings",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      const settings = await settingsService.getSystemSettings();
      return reply.send(settings);
    },
  );

  // 9. System Settings — Super Admin update (strictly gated to Super Admin)
  app.patch(
    "/api/v1/admin/system-settings",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parseResult = UpdateSystemSettingsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          message: "Invalid system settings payload",
          errors: parseResult.error.flatten(),
        });
      }

      const adminId = getUserId(request);
      const updated = await settingsService.updateSystemSettings(
        parseResult.data.isSellerEnabled,
        adminId,
      );

      return reply.send({
        message: `Seller/Vendor platform feature successfully ${updated.isSellerEnabled ? "enabled" : "disabled"}`,
        settings: updated,
      });
    },
  );

  // 10. Admin Delegations — List all active Manage Admins (Super Admin only)
  app.get(
    "/api/v1/admin/delegations",
    { preHandler: [requireSuperAdmin] },
    async (_request, reply) => {
      const delegations = await db
        .select()
        .from(adminDelegations)
        .orderBy(desc(adminDelegations.createdAt));
      return reply.send({ delegations });
    },
  );

  // 11. Admin Delegations — Grant Manage Admin delegation (Super Admin only)
  app.post(
    "/api/v1/admin/delegations",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parseResult = GrantDelegationSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          message: "Invalid delegation payload",
          errors: parseResult.error.flatten(),
        });
      }

      const superAdminId = getUserId(request) || "system-super-admin";
      const { adminUserId } = parseResult.data;

      // Check if already delegated
      const existing = await db
        .select()
        .from(adminDelegations)
        .where(
          and(
            eq(adminDelegations.adminUserId, adminUserId),
            eq(adminDelegations.permission, "manage_sellers"),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        return reply.send({
          message: "Admin already has manage_sellers delegation",
          delegation: existing[0],
        });
      }

      const id = `del_${uuidv4()}`;
      await db.insert(adminDelegations).values({
        id,
        adminUserId,
        permission: "manage_sellers",
        grantedByUserId: superAdminId,
      });

      const [newDelegation] = await db
        .select()
        .from(adminDelegations)
        .where(eq(adminDelegations.id, id))
        .limit(1);

      return reply.status(201).send({
        message: "Manage Admin verification delegation granted successfully",
        delegation: newDelegation,
      });
    },
  );

  // 12. Admin Delegations — Revoke Manage Admin delegation (Super Admin only)
  app.delete(
    "/api/v1/admin/delegations/:adminUserId",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { adminUserId } = request.params as { adminUserId: string };

      await db
        .delete(adminDelegations)
        .where(eq(adminDelegations.adminUserId, adminUserId));

      return reply.send({
        success: true,
        message: `Delegation for admin ${adminUserId} revoked successfully`,
        adminUserId,
      });
    },
  );
};
