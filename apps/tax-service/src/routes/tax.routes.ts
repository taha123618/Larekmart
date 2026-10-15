import type { FastifyInstance } from "fastify";
import { TaxController } from "../controllers/tax.controller.js";

export async function taxRoutes(fastify: FastifyInstance): Promise<void> {
  // Public & Checkout Endpoints
  fastify.post("/api/v1/tax/quote", TaxController.quote);
  fastify.post("/api/v1/tax/calculate", TaxController.calculate);
  fastify.get(
    "/api/v1/tax/calculations/:calculationId",
    TaxController.getCalculation,
  );
  fastify.post("/api/v1/tax/returns/quote", TaxController.returnQuote);

  // Master Data Read Endpoints
  fastify.get("/api/v1/tax/jurisdictions", TaxController.getJurisdictions);
  fastify.get("/api/v1/tax/categories", TaxController.getCategories);
}
