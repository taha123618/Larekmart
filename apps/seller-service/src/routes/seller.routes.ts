import type { FastifyPluginAsync } from "fastify";
import { eq, and, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  CreateSellerSchema,
  UpdateSellerSchema,
  UpdateStorefrontSchema,
  AddStaffSchema,
  UpdateSellerSettingsSchema,
  UpsertPolicySchema,
} from "@repo/types";
import { db } from "../db/connection.js";
import {
  sellers,
  sellerStores,
  sellerStaff,
  sellerSettings,
  sellerPolicies,
  sellerStatusHistory,
  sellerPerformanceSnapshots,
} from "../db/schema.js";
import {
  requireUser,
  requireSellerStaffOrAdmin,
  requireSellerEnabled,
  requireSellerQualification,
  getUserId,
} from "../middleware/auth.middleware.js";
import { sellerEventProducer } from "../kafka/producer.js";
import { cacheService } from "../services/cache.service.js";

export const sellerRoutes: FastifyPluginAsync = async (app) => {
  // Enforce project-wide seller feature enablement across all merchant seller operations
  app.addHook("preHandler", requireSellerEnabled);

  // 1. Create a new seller linked to verified vendor
  app.post(
    "/api/v1/sellers",
    { preHandler: [requireUser, requireSellerQualification] },
    async (request, reply) => {
      const userId = getUserId(request)!;
      const body = CreateSellerSchema.parse(request.body);
      const computedSlug =
        body.slug ||
        body.storeName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      // Check if slug is already taken
      const existingSlug = await db
        .select({ id: sellerStores.id })
        .from(sellerStores)
        .where(eq(sellerStores.slug, computedSlug))
        .limit(1);

      if (existingSlug.length > 0) {
        return reply
          .status(409)
          .send({ message: "Store slug is already in use" });
      }

      const sellerId = `sel_${uuidv4()}`;
      const storeId = `str_${uuidv4()}`;
      const settingsId = `set_${uuidv4()}`;
      const staffId = `stf_${uuidv4()}`;
      const perfId = `prf_${uuidv4()}`;

      // Insert seller record
      await db.insert(sellers).values({
        id: sellerId,
        vendorId: body.vendorId,
        primaryUserId: userId,
        status: "ACTIVE", // Created & ready
      });

      // Insert store record
      await db.insert(sellerStores).values({
        id: storeId,
        sellerId,
        name: body.storeName,
        slug: computedSlug,
        headline: body.headline || null,
        description: body.description || null,
        logoMediaId: body.logoMediaId || null,
        bannerMediaId: body.bannerMediaId || null,
        status: "ACTIVE",
        vacationMode: false,
      });

      // Insert default settings
      await db.insert(sellerSettings).values({
        id: settingsId,
        sellerId,
        defaultCurrency: "USD",
        autoAcceptOrders: true,
        lowStockThreshold: 5,
      });

      // Insert primary owner as staff with OWNER role
      await db.insert(sellerStaff).values({
        id: staffId,
        sellerId,
        userId,
        email: `${userId}@marketplace.seller`,
        name: "Store Owner",
        role: "OWNER",
        status: "ACTIVE",
        permissions: ["*"],
      });

      // Initialize performance snapshot
      await db.insert(sellerPerformanceSnapshots).values({
        id: perfId,
        sellerId,
        rating: "5.00",
        totalReviews: 0,
        orderFulfillmentRate: "100.00",
        cancellationRate: "0.00",
        totalOrdersCompleted: 0,
        responseTimeHours: "2.00",
      });

      // Publish Kafka seller.created event
      await sellerEventProducer.publishSellerCreated({
        sellerId,
        vendorId: body.vendorId,
        primaryUserId: userId,
        storeName: body.storeName,
        slug: computedSlug,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      });

      return reply.status(201).send({
        sellerId,
        storeId,
        storeName: body.storeName,
        slug: computedSlug,
        status: "ACTIVE",
      });
    },
  );

  // 2. List all sellers the authenticated user is an owner or staff of
  app.get(
    "/api/v1/sellers/me",
    { preHandler: [requireUser] },
    async (request, reply) => {
      const userId = getUserId(request)!;

      // Find all sellers where user is primary or staff
      const userStaffEntries = await db
        .select({ sellerId: sellerStaff.sellerId, role: sellerStaff.role })
        .from(sellerStaff)
        .where(eq(sellerStaff.userId, userId));

      const staffSellerIds = userStaffEntries.map((e) => e.sellerId);

      const userSellers = await db
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
        .where(
          staffSellerIds.length > 0
            ? or(
                eq(sellers.primaryUserId, userId),
                eq(sellers.id, staffSellerIds[0]!),
              )
            : eq(sellers.primaryUserId, userId),
        );

      return reply.send(userSellers);
    },
  );

  // 3. Get seller details by ID
  app.get(
    "/api/v1/sellers/:sellerId",
    { preHandler: [requireSellerStaffOrAdmin] },
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

      const storeRows = await db
        .select()
        .from(sellerStores)
        .where(eq(sellerStores.sellerId, sellerId))
        .limit(1);

      const settingsRows = await db
        .select()
        .from(sellerSettings)
        .where(eq(sellerSettings.sellerId, sellerId))
        .limit(1);

      const perfRows = await db
        .select()
        .from(sellerPerformanceSnapshots)
        .where(eq(sellerPerformanceSnapshots.sellerId, sellerId))
        .limit(1);

      return reply.send({
        seller: sellerRows[0],
        store: storeRows[0] || null,
        settings: settingsRows[0] || null,
        performance: perfRows[0] || null,
      });
    },
  );

  // 4. Update seller account details
  app.patch(
    "/api/v1/sellers/:sellerId",
    { preHandler: [requireSellerStaffOrAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const userId = getUserId(request) || "system";
      const body = UpdateSellerSchema.parse(request.body);

      const sellerRows = await db
        .select()
        .from(sellers)
        .where(eq(sellers.id, sellerId))
        .limit(1);

      if (sellerRows.length === 0) {
        return reply.status(404).send({ message: "Seller not found" });
      }

      const currentSeller = sellerRows[0]!;
      const updateData: Partial<typeof sellers.$inferInsert> = {
        updatedAt: new Date(),
      };
      const updatedFields: string[] = [];

      if (
        body.primaryUserId !== undefined &&
        body.primaryUserId !== currentSeller.primaryUserId
      ) {
        updateData.primaryUserId = body.primaryUserId;
        updatedFields.push("primaryUserId");
      }

      const prevStatus = currentSeller.status;
      if (body.status !== undefined && body.status !== prevStatus) {
        updateData.status = body.status;
        updatedFields.push("status");

        // Record in status history
        await db.insert(sellerStatusHistory).values({
          id: `h_${uuidv4()}`,
          sellerId,
          previousStatus: prevStatus,
          newStatus: body.status,
          reason: body.reason || "Status updated via seller API",
          changedByUserId: userId,
        });

        if (body.status === "ACTIVE") {
          await sellerEventProducer.publishSellerActivated({
            sellerId,
            vendorId: currentSeller.vendorId,
            userId: currentSeller.primaryUserId,
            primaryUserId: currentSeller.primaryUserId,
            isSeller: true,
            activatedAt: new Date().toISOString(),
            activatedByUserId: userId,
          });
        } else if (body.status === "SUSPENDED") {
          await sellerEventProducer.publishSellerSuspended({
            sellerId,
            vendorId: currentSeller.vendorId,
            userId: currentSeller.primaryUserId,
            primaryUserId: currentSeller.primaryUserId,
            isSeller: false,
            reason: body.reason || "Suspended by user request",
            suspendedAt: new Date().toISOString(),
            suspendedByUserId: userId,
          });
        }
      }

      if (updatedFields.length > 0) {
        await db
          .update(sellers)
          .set(updateData)
          .where(eq(sellers.id, sellerId));

        await sellerEventProducer.publishSellerUpdated({
          sellerId,
          updatedFields,
          updatedAt: new Date().toISOString(),
        });
      }

      const refreshed = await db
        .select()
        .from(sellers)
        .where(eq(sellers.id, sellerId))
        .limit(1);

      return reply.send(refreshed[0]);
    },
  );

  // 5. Update storefront details
  app.patch(
    "/api/v1/sellers/:sellerId/storefront",
    { preHandler: [requireSellerStaffOrAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const body = UpdateStorefrontSchema.parse(request.body);

      const storeRows = await db
        .select()
        .from(sellerStores)
        .where(eq(sellerStores.sellerId, sellerId))
        .limit(1);

      if (storeRows.length === 0) {
        return reply.status(404).send({ message: "Storefront not found" });
      }

      const currentStore = storeRows[0]!;

      // If updating slug, check uniqueness
      if (body.slug && body.slug !== currentStore.slug) {
        const existingSlug = await db
          .select({ id: sellerStores.id })
          .from(sellerStores)
          .where(eq(sellerStores.slug, body.slug))
          .limit(1);

        if (existingSlug.length > 0) {
          return reply
            .status(409)
            .send({ message: "Store slug is already in use" });
        }
      }

      const updateData: Partial<typeof sellerStores.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.slug !== undefined) updateData.slug = body.slug;
      if (body.headline !== undefined) updateData.headline = body.headline;
      if (body.description !== undefined)
        updateData.description = body.description;
      if (body.logoMediaId !== undefined)
        updateData.logoMediaId = body.logoMediaId;
      if (body.bannerMediaId !== undefined)
        updateData.bannerMediaId = body.bannerMediaId;
      if (body.vacationMode !== undefined)
        updateData.vacationMode = body.vacationMode;
      if (body.vacationMessage !== undefined)
        updateData.vacationMessage = body.vacationMessage;
      if (body.vacationEndDate !== undefined) {
        updateData.vacationEndDate = body.vacationEndDate
          ? new Date(body.vacationEndDate)
          : null;
      }
      if (body.status !== undefined) updateData.status = body.status;

      await db
        .update(sellerStores)
        .set(updateData)
        .where(eq(sellerStores.id, currentStore.id));

      const updatedStoreRows = await db
        .select()
        .from(sellerStores)
        .where(eq(sellerStores.id, currentStore.id))
        .limit(1);

      const updated = updatedStoreRows[0]!;

      // Invalidate cache
      await cacheService.invalidateStorefront(currentStore.slug, sellerId);
      if (body.slug && body.slug !== currentStore.slug) {
        await cacheService.invalidateStorefront(body.slug, sellerId);
      }

      // Publish Kafka event
      await sellerEventProducer.publishSellerStorefrontUpdated({
        sellerId,
        storeId: updated.id,
        storeName: updated.name,
        slug: updated.slug,
        vacationMode: updated.vacationMode,
        status: updated.status,
        updatedAt: new Date().toISOString(),
      });

      return reply.send(updated);
    },
  );

  // 5. Add staff member
  app.post(
    "/api/v1/sellers/:sellerId/staff",
    { preHandler: [requireSellerStaffOrAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const body = AddStaffSchema.parse(request.body);

      // Check if user is already a staff member
      const existing = await db
        .select({ id: sellerStaff.id })
        .from(sellerStaff)
        .where(
          and(
            eq(sellerStaff.sellerId, sellerId),
            eq(sellerStaff.userId, body.userId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        return reply
          .status(409)
          .send({ message: "User is already a staff member" });
      }

      const staffId = `stf_${uuidv4()}`;
      await db.insert(sellerStaff).values({
        id: staffId,
        sellerId,
        userId: body.userId,
        email: body.email,
        name: body.name || "Staff Member",
        role: body.role,
        status: "ACTIVE",
        permissions: body.permissions,
      });

      const inserted = await db
        .select()
        .from(sellerStaff)
        .where(eq(sellerStaff.id, staffId))
        .limit(1);

      return reply.status(201).send(inserted[0]);
    },
  );

  // 6. List staff members
  app.get(
    "/api/v1/sellers/:sellerId/staff",
    { preHandler: [requireSellerStaffOrAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const staffList = await db
        .select()
        .from(sellerStaff)
        .where(eq(sellerStaff.sellerId, sellerId));
      return reply.send(staffList);
    },
  );

  // 7. Update operational settings
  app.patch(
    "/api/v1/sellers/:sellerId/settings",
    { preHandler: [requireSellerStaffOrAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const body = UpdateSellerSettingsSchema.parse(request.body);

      const updateData: Partial<typeof sellerSettings.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (body.defaultCurrency !== undefined)
        updateData.defaultCurrency = body.defaultCurrency;
      if (body.shippingOriginPostalCode !== undefined) {
        updateData.shippingOriginPostalCode = body.shippingOriginPostalCode;
      }
      if (body.autoAcceptOrders !== undefined)
        updateData.autoAcceptOrders = body.autoAcceptOrders;
      if (body.lowStockThreshold !== undefined)
        updateData.lowStockThreshold = body.lowStockThreshold;
      if (body.supportEmail !== undefined)
        updateData.supportEmail = body.supportEmail;
      if (body.supportPhone !== undefined)
        updateData.supportPhone = body.supportPhone;
      if (body.notificationPreferences !== undefined) {
        updateData.notificationPreferences = body.notificationPreferences;
      }

      await db
        .update(sellerSettings)
        .set(updateData)
        .where(eq(sellerSettings.sellerId, sellerId));

      const updated = await db
        .select()
        .from(sellerSettings)
        .where(eq(sellerSettings.sellerId, sellerId))
        .limit(1);

      return reply.send(updated[0] || null);
    },
  );

  // 8. Upsert policy
  app.put(
    "/api/v1/sellers/:sellerId/policies",
    { preHandler: [requireSellerStaffOrAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const body = UpsertPolicySchema.parse(request.body);

      const existing = await db
        .select({ id: sellerPolicies.id })
        .from(sellerPolicies)
        .where(
          and(
            eq(sellerPolicies.sellerId, sellerId),
            eq(sellerPolicies.policyType, body.policyType),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(sellerPolicies)
          .set({
            title: body.title,
            content: body.content,
            updatedAt: new Date(),
          })
          .where(eq(sellerPolicies.id, existing[0]!.id));
      } else {
        await db.insert(sellerPolicies).values({
          id: `pol_${uuidv4()}`,
          sellerId,
          policyType: body.policyType,
          title: body.title,
          content: body.content,
        });
      }

      const policyList = await db
        .select()
        .from(sellerPolicies)
        .where(eq(sellerPolicies.sellerId, sellerId));

      return reply.send(policyList);
    },
  );

  // 9. Get performance metrics
  app.get(
    "/api/v1/sellers/:sellerId/performance",
    { preHandler: [requireSellerStaffOrAdmin] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const snapshots = await db
        .select()
        .from(sellerPerformanceSnapshots)
        .where(eq(sellerPerformanceSnapshots.sellerId, sellerId))
        .limit(1);

      if (snapshots.length === 0) {
        return reply
          .status(404)
          .send({ message: "Performance snapshot not found" });
      }

      return reply.send(snapshots[0]);
    },
  );
};
