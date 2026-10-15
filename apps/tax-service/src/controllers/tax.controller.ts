import type { FastifyRequest, FastifyReply } from "fastify";
import {
  TaxQuoteRequestSchema,
  TaxCalculateRequestSchema,
  TaxReturnQuoteRequestSchema,
} from "@repo/types";
import { taxService } from "../services/tax.service.js";
import { jurisdictionRepository } from "../repositories/jurisdiction.repository.js";
import { taxCategoryRepository } from "../repositories/tax-category.repository.js";

export class TaxController {
  /**
   * POST /api/v1/tax/quote
   */
  public static async quote(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parseResult = TaxQuoteRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        message: "Invalid tax quote payload",
        errors: parseResult.error.format(),
      });
      return;
    }

    try {
      const result = await taxService.quoteTax(parseResult.data);
      reply.status(200).send(result);
    } catch (err) {
      request.log.error(err, "Tax quote failed");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to calculate tax quote",
      });
    }
  }

  /**
   * POST /api/v1/tax/calculate
   */
  public static async calculate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parseResult = TaxCalculateRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        message: "Invalid tax calculate payload",
        errors: parseResult.error.format(),
      });
      return;
    }

    try {
      const result = await taxService.calculateTax(parseResult.data);
      reply.status(200).send(result);
    } catch (err) {
      request.log.error(err, "Tax calculation failed");
      reply.status(500).send({
        message:
          err instanceof Error
            ? err.message
            : "Failed to process tax calculation",
      });
    }
  }

  /**
   * GET /api/v1/tax/calculations/:calculationId
   */
  public static async getCalculation(
    request: FastifyRequest<{ Params: { calculationId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { calculationId } = request.params;
    if (!calculationId) {
      reply.status(400).send({ message: "Calculation ID is required" });
      return;
    }

    try {
      const result = await taxService.getCalculationById(calculationId);
      if (!result) {
        reply
          .status(404)
          .send({ message: `Tax calculation '${calculationId}' not found` });
        return;
      }
      reply.status(200).send(result);
    } catch (err) {
      request.log.error(err, "Tax calculation lookup failed");
      reply.status(500).send({
        message:
          err instanceof Error
            ? err.message
            : "Failed to retrieve tax calculation",
      });
    }
  }

  /**
   * POST /api/v1/tax/returns/quote
   */
  public static async returnQuote(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parseResult = TaxReturnQuoteRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        message: "Invalid tax return quote payload",
        errors: parseResult.error.format(),
      });
      return;
    }

    try {
      const result = await taxService.quoteReturnTax(parseResult.data);
      reply.status(200).send(result);
    } catch (err) {
      request.log.error(err, "Tax return quote failed");
      reply.status(500).send({
        message:
          err instanceof Error
            ? err.message
            : "Failed to quote tax return adjustment",
      });
    }
  }

  /**
   * GET /api/v1/tax/jurisdictions
   */
  public static async getJurisdictions(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const jurisdictions = await jurisdictionRepository.findAll({
        isActive: true,
      });
      reply.status(200).send(jurisdictions);
    } catch (err) {
      request.log.error(err, "Failed to fetch tax jurisdictions");
      reply.status(500).send({ message: "Failed to fetch tax jurisdictions" });
    }
  }

  /**
   * GET /api/v1/tax/categories
   */
  public static async getCategories(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const categories = await taxCategoryRepository.findAll(true);
      reply.status(200).send(categories);
    } catch (err) {
      request.log.error(err, "Failed to fetch tax categories");
      reply.status(500).send({ message: "Failed to fetch tax categories" });
    }
  }
}
