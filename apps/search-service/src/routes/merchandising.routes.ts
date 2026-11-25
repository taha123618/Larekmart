import type { FastifyPluginAsync } from "fastify";
import {
  MerchandisingRuleSchema,
  getTopZeroResultQueries,
  recordZeroResultQuery,
  resolveMerchandisingForQuery,
  upsertMerchandisingRule,
} from "../services/merchandising.service.js";

export const merchandisingRoutes: FastifyPluginAsync = async (app) => {
  app.put("/merchandising/rules", async (request, reply) => {
    const parsed = MerchandisingRuleSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid merchandising rule payload",
        issues: parsed.error.issues,
      });
    }
    return reply.send({ rule: upsertMerchandisingRule(parsed.data) });
  });

  app.get("/merchandising/rules", async (request, reply) => {
    const { query } = request.query as { query?: string };
    if (!query) return reply.status(400).send({ message: "query parameter is required" });
    return reply.send({ rule: resolveMerchandisingForQuery(query) });
  });

  app.post("/analytics/zero-results", async (request, reply) => {
    const body = (request.body ?? {}) as { query?: string };
    if (!body.query) return reply.status(400).send({ message: "query is required" });
    return reply.status(201).send({ record: recordZeroResultQuery(body.query) });
  });

  app.get("/analytics/zero-results", async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    return reply.send({ queries: getTopZeroResultQueries(Number(limit) || 20) });
  });
};
