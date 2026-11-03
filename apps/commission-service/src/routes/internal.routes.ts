import type { FastifyInstance } from "fastify";
import { commissionService } from "../services/commission.service.js";
import { requireInternalSecret } from "../middleware/auth.middleware.js";
import { CommissionQuoteRequestSchema } from "@repo/types";

export async function internalCommissionRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireInternalSecret);

  /**
   * POST /api/v1/internal/commissions/quote
   * Generates real-time marketplace commission calculations for order items.
   */
  fastify.post("/quote", async (request, reply) => {
    const parseResult = CommissionQuoteRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        message: "Invalid commission quote payload",
        errors: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const quote = await commissionService.createQuote(parseResult.data);
    return reply.status(200).send(quote);
  });

  /**
   * GET /api/v1/internal/commissions/orders/:orderId
   * Retrieves calculation snapshot, line items, and adjustments for a given order.
   */
  fastify.get("/orders/:orderId", async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    if (!orderId) {
      reply.status(400).send({ message: "orderId parameter is required" });
      return;
    }

    const data = await commissionService.getOrderCommissions(orderId);
    return reply.status(200).send(data);
  });
}
