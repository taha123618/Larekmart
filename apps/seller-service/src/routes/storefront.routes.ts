import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/connection.js";
import { sellerStores, sellers, sellerPolicies } from "../db/schema.js";
import { cacheService } from "../services/cache.service.js";

export const storefrontRoutes: FastifyPluginAsync = async (app) => {
  // Public endpoint: Fetch storefront by URL slug
  app.get("/api/v1/storefronts/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };

    // Check Redis cache first
    const cached = await cacheService.getStorefrontBySlug(slug);
    if (cached) {
      return reply.send(cached);
    }

    const stores = await db
      .select({
        id: sellerStores.id,
        sellerId: sellerStores.sellerId,
        name: sellerStores.name,
        slug: sellerStores.slug,
        headline: sellerStores.headline,
        description: sellerStores.description,
        logoMediaId: sellerStores.logoMediaId,
        bannerMediaId: sellerStores.bannerMediaId,
        status: sellerStores.status,
        vacationMode: sellerStores.vacationMode,
        vacationMessage: sellerStores.vacationMessage,
        vacationEndDate: sellerStores.vacationEndDate,
        sellerStatus: sellers.status,
      })
      .from(sellerStores)
      .innerJoin(sellers, eq(sellerStores.sellerId, sellers.id))
      .where(eq(sellerStores.slug, slug))
      .limit(1);

    if (stores.length === 0) {
      return reply.status(404).send({ message: "Storefront not found" });
    }

    const store = stores[0]!;

    // Fetch public policies for this store
    const policies = await db
      .select({
        policyType: sellerPolicies.policyType,
        title: sellerPolicies.title,
        content: sellerPolicies.content,
      })
      .from(sellerPolicies)
      .where(eq(sellerPolicies.sellerId, store.sellerId));

    const responsePayload = {
      ...store,
      policies,
    };

    // Cache in Redis for 300 seconds
    await cacheService.setStorefrontBySlug(slug, responsePayload, 300);

    return reply.send(responsePayload);
  });

  // Public/storefront endpoint: Fetch storefront by seller ID
  app.get("/api/v1/sellers/:sellerId/storefront", async (request, reply) => {
    const { sellerId } = request.params as { sellerId: string };

    const stores = await db
      .select()
      .from(sellerStores)
      .where(eq(sellerStores.sellerId, sellerId))
      .limit(1);

    if (stores.length === 0) {
      return reply.status(404).send({ message: "Storefront not found for this seller" });
    }

    const store = stores[0]!;
    const policies = await db
      .select()
      .from(sellerPolicies)
      .where(eq(sellerPolicies.sellerId, sellerId));

    return reply.send({
      ...store,
      policies,
    });
  });
};
