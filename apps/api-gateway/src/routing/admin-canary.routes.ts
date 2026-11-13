import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/authorization.js";
import { logger } from "../observability/logger.js";
import { canaryProber, executeCanaryScenario } from "../utils/canary-daemon.js";
import type { CanaryScenarioType } from "@repo/monitoring";

const triggerBodySchema = z.object({
  scenario: z.enum(["read", "checkout"]).default("read"),
});

export const adminCanaryRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/admin/canary/runs
   * Returns recent synthetic probe execution runs with step waterfalls.
   */
  fastify.get(
    "/api/v1/admin/canary/runs",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const query = request.query as { scenario?: string; limit?: string };
      const scenario =
        query.scenario === "read" || query.scenario === "checkout"
          ? (query.scenario as CanaryScenarioType)
          : undefined;
      const limit = query.limit ? Number.parseInt(query.limit, 10) || 50 : 50;

      try {
        const runs = await canaryProber.getRecentRuns(scenario, limit);
        return reply.send({ success: true, count: runs.length, data: runs });
      } catch (err: any) {
        logger.error(`Failed to fetch canary runs: ${err.message}`);
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: "Failed to retrieve canary runs",
        });
      }
    },
  );

  /**
   * GET /api/v1/admin/canary/sla
   * Returns current rolling SLA statistics and consecutive failure counters.
   */
  fastify.get(
    "/api/v1/admin/canary/sla",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      try {
        const [readSla, checkoutSla] = await Promise.all([
          canaryProber.calculateSla("read"),
          canaryProber.calculateSla("checkout"),
        ]);

        return reply.send({
          success: true,
          data: {
            read: readSla,
            checkout: checkoutSla,
          },
        });
      } catch (err: any) {
        logger.error(`Failed to calculate canary SLA: ${err.message}`);
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: "Failed to calculate canary SLA",
        });
      }
    },
  );

  /**
   * POST /api/v1/admin/canary/trigger
   * Triggers an immediate synthetic canary probe on-demand.
   */
  fastify.post(
    "/api/v1/admin/canary/trigger",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parseResult = triggerBodySchema.safeParse(request.body ?? {});
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid scenario. Expected 'read' or 'checkout'.",
          details: parseResult.error.issues,
        });
      }
      const scenario = parseResult.data.scenario;

      try {
        logger.info(`Admin triggered on-demand canary probe: ${scenario}`, {
          adminUserId: request.authUserId,
          scenario,
        });

        // Derive host from current request headers or localhost fallback
        const host = request.headers.host || "localhost:8080";
        const protocol = request.protocol || "http";
        const gatewayUrl = `${protocol}://${host}`;

        const run = await executeCanaryScenario(scenario, gatewayUrl);
        return reply.status(200).send({
          success: true,
          message: `Canary probe ${scenario} executed successfully`,
          data: run,
        });
      } catch (err: any) {
        logger.error(`On-demand canary trigger failed: ${err.message}`);
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: "Failed to execute on-demand canary probe",
        });
      }
    },
  );
};
