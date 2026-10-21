import type { FastifyPluginAsync } from "fastify";
import { pricingService } from "../services/pricing.service.js";
import { requireAdminOrInternal } from "../middleware/auth.middleware.js";
import {
  CreatePriceListSchema,
  UpsertProductPriceSchema,
  UpdateProductPriceSchema,
} from "@repo/types";

export const adminPricesRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply admin or internal service authentication to all admin routes
  fastify.addHook("preHandler", requireAdminOrInternal);

  /**
   * POST /api/v1/admin/price-lists
   * Creates new price list (B2B, B2C, or seller-specific)
   */
  fastify.post("/price-lists", async (request, reply) => {
    const parsed = CreatePriceListSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid price list payload",
        errors: parsed.error.issues,
      });
    }

    try {
      const priceList = await pricingService.createPriceList(parsed.data);
      return reply.status(201).send(priceList);
    } catch (err) {
      return reply.status(400).send({
        message:
          err instanceof Error ? err.message : "Failed to create price list",
      });
    }
  });

  /**
   * POST /api/v1/admin/prices
   * Upserts product base price and currency
   */
  fastify.post("/prices", async (request, reply) => {
    const parsed = UpsertProductPriceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid product price payload",
        errors: parsed.error.issues,
      });
    }

    try {
      const price = await pricingService.upsertProductPrice(parsed.data);
      return reply.status(200).send(price);
    } catch (err) {
      return reply.status(400).send({
        message:
          err instanceof Error ? err.message : "Failed to upsert product price",
      });
    }
  });

  /**
   * PATCH /api/v1/admin/prices/:priceId
   * Updates product price and records audit log
   */
  fastify.patch<{ Params: { priceId: string } }>(
    "/prices/:priceId",
    async (request, reply) => {
      const { priceId } = request.params;
      const parsed = UpdateProductPriceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid update payload",
          errors: parsed.error.issues,
        });
      }

      const updated = await pricingService.patchProductPrice(
        priceId,
        parsed.data,
      );
      if (!updated) {
        return reply
          .status(404)
          .send({ message: `Price record ${priceId} not found` });
      }

      return reply.status(200).send(updated);
    },
  );

  /**
   * GET /api/v1/admin/price-lists
   * Retrieves all price lists
   */
  fastify.get("/price-lists", async (_request, reply) => {
    const lists = await pricingService.getPriceLists();
    return reply.status(200).send({ priceLists: lists });
  });

  /**
   * GET /api/v1/admin/prices
   * Retrieves all product prices with price list info
   */
  fastify.get<{
    Querystring: { priceListId?: string };
  }>("/prices", async (request, reply) => {
    const prices = await pricingService.getProductPricesList(
      request.query.priceListId,
    );
    return reply.status(200).send({ prices });
  });

  /**
   * GET /api/v1/admin/prices/rules
   * Retrieves all tiered and volume discount rules
   */
  fastify.get<{
    Querystring: { priceListId?: string };
  }>("/prices/rules", async (request, reply) => {
    const rules = await pricingService.getPriceRules(request.query.priceListId);
    return reply.status(200).send({ rules });
  });

  /**
   * POST /api/v1/admin/prices/rules
   * Creates new tiered or volume discount rule
   */
  fastify.post<{
    Body: {
      priceListId: string;
      ruleType: "tier" | "bulk" | "customer_group";
      productId?: string;
      variantId?: string;
      minQuantity: number;
      maxQuantity?: number;
      discountType: "percentage" | "fixed_amount" | "override_price";
      discountValue: number;
      priority?: number;
      validFrom?: string;
      validTo?: string;
      isActive?: boolean;
    };
  }>("/prices/rules", async (request, reply) => {
    try {
      const rule = await pricingService.createPriceRule(request.body);
      return reply.status(201).send(rule);
    } catch (err) {
      return reply.status(400).send({
        message:
          err instanceof Error ? err.message : "Failed to create price rule",
      });
    }
  });

  /**
   * GET /api/v1/admin/prices/currencies
   * Retrieves currency exchange rates
   */
  fastify.get("/prices/currencies", async (_request, reply) => {
    const rates = await pricingService.getCurrencyRates();
    return reply.status(200).send({ rates });
  });

  /**
   * POST /api/v1/admin/prices/currencies
   * Upserts currency exchange rate
   */
  fastify.post<{
    Body: {
      baseCurrency: string;
      targetCurrency: string;
      exchangeRate: number;
    };
  }>("/prices/currencies", async (request, reply) => {
    const { baseCurrency, targetCurrency, exchangeRate } = request.body;
    if (!baseCurrency || !targetCurrency || typeof exchangeRate !== "number") {
      return reply
        .status(400)
        .send({ message: "Invalid currency rate payload" });
    }

    const rate = await pricingService.upsertCurrencyRate(
      baseCurrency,
      targetCurrency,
      exchangeRate,
    );
    return reply.status(200).send(rate);
  });

  /**
   * GET /api/v1/admin/prices/:priceId/history
   * Retrieves complete audit history for price modifications
   */
  fastify.get<{ Params: { priceId: string } }>(
    "/prices/:priceId/history",
    async (request, reply) => {
      const { priceId } = request.params;
      const history = await pricingService.getPriceHistory(priceId);
      return reply.status(200).send({ history });
    },
  );
};
