import type { FastifyPluginAsync } from "fastify";
import { pricingService } from "../services/pricing.service.js";
import { quoteService } from "../services/quote.service.js";
import {
  PriceQuoteRequestSchema,
  BulkPriceQuoteRequestSchema,
} from "@repo/types";

export const pricesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/prices/products/:productId
   * Fetches active product price, variant prices, and rules with currency conversion
   */
  fastify.get<{
    Params: { productId: string };
    Querystring: { currency?: string; priceListCode?: string };
  }>("/products/:productId", async (request, reply) => {
    const { productId } = request.params;
    const { currency = "USD", priceListCode } = request.query;

    const price = await pricingService.getProductPrice(
      productId,
      currency,
      priceListCode,
    );

    if (!price) {
      return reply.status(404).send({
        message: `Product ${productId} not found in active price list`,
      });
    }

    return reply.status(200).send(price);
  });

  /**
   * POST /api/v1/prices/quote
   * Generates authoritative price quote with volume tiers & promotion deduction
   */
  fastify.post("/quote", async (request, reply) => {
    const parsed = PriceQuoteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid price quote request payload",
        errors: parsed.error.issues,
      });
    }

    try {
      const quote = await quoteService.generateQuote(parsed.data);
      return reply.status(200).send(quote);
    } catch (err) {
      return reply.status(400).send({
        message:
          err instanceof Error ? err.message : "Failed to generate price quote",
      });
    }
  });

  /**
   * POST /api/v1/prices/bulk-quote
   * Generates multiple price quotes in a single batch
   */
  fastify.post("/bulk-quote", async (request, reply) => {
    const parsed = BulkPriceQuoteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid bulk price quote request payload",
        errors: parsed.error.issues,
      });
    }

    try {
      const quotes = await quoteService.generateBulkQuotes(parsed.data);
      return reply.status(200).send({ quotes });
    } catch (err) {
      return reply.status(400).send({
        message:
          err instanceof Error ? err.message : "Failed to generate bulk quotes",
      });
    }
  });

  /**
   * GET /api/v1/prices/currencies
   * Retrieves active supported currency exchange rates
   */
  fastify.get("/currencies", async (_request, reply) => {
    const rates = await pricingService.getCurrencyRates();
    return reply.status(200).send({ rates });
  });
};
