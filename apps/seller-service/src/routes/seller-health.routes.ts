import type { FastifyPluginAsync } from "fastify";
import { requireUser } from "../middleware/auth.middleware.js";
import {
  SlaScorecardInputSchema,
  StaffAuditInputSchema,
  computeSellerSlaScorecard,
  getStaffAuditLogs,
  recordStaffAuditEvent,
} from "../services/seller-health.service.js";

export const sellerHealthRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/v1/sellers/:sellerId/sla-scorecard",
    { preHandler: [requireUser] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const parsed = SlaScorecardInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid SLA scorecard input",
          issues: parsed.error.issues,
        });
      }
      const scorecard = computeSellerSlaScorecard(sellerId, parsed.data);
      return reply.send({ scorecard });
    },
  );

  app.post(
    "/api/v1/sellers/:sellerId/staff-audit",
    { preHandler: [requireUser] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      const parsed = StaffAuditInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid staff audit payload",
          issues: parsed.error.issues,
        });
      }
      const actorId = (request as { userId?: string }).userId || "system";
      const entry = recordStaffAuditEvent(sellerId, actorId, parsed.data);
      return reply.status(201).send({ entry });
    },
  );

  app.get(
    "/api/v1/sellers/:sellerId/staff-audit",
    { preHandler: [requireUser] },
    async (request, reply) => {
      const { sellerId } = request.params as { sellerId: string };
      return reply.send({ logs: getStaffAuditLogs(sellerId) });
    },
  );
};
