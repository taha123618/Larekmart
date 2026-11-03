import type { FastifyInstance } from "fastify";
import { commissionService } from "../services/commission.service.js";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { db } from "../db/connection.js";
import { commissionPlans, commissionRules } from "../db/schema.js";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const createPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
});

const updateRuleSchema = z.object({
  percentageRate: z.number().min(0).max(100).optional(),
  fixedAmount: z.number().min(0).optional(),
  minCommission: z.number().min(0).nullable().optional(),
  maxCommission: z.number().min(0).nullable().optional(),
  priority: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  changeReason: z.string().min(1),
});

const createRuleSchema = z.object({
  planId: z.string().min(1),
  ruleType: z.enum(["PERCENTAGE", "FIXED", "TIERED", "HYBRID"]).default("PERCENTAGE"),
  scope: z.enum(["GLOBAL", "SELLER", "CATEGORY", "PRODUCT"]).default("GLOBAL"),
  scopeId: z.string().optional().nullable(),
  percentageRate: z.number().min(0).max(100).default(0),
  fixedAmount: z.number().min(0).default(0),
  minCommission: z.number().min(0).optional().nullable(),
  maxCommission: z.number().min(0).optional().nullable(),
  priority: z.number().int().default(0),
});

export async function adminCommissionRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireAdmin);

  /**
   * GET /api/v1/admin/commissions/plans
   */
  fastify.get("/plans", async (_request, reply) => {
    const plans = await db.select().from(commissionPlans);
    return reply.status(200).send(plans);
  });

  /**
   * POST /api/v1/admin/commissions/plans
   */
  fastify.post("/plans", async (request, reply) => {
    const parse = createPlanSchema.safeParse(request.body);
    if (!parse.success) {
      reply.status(400).send({
        message: "Invalid commission plan",
        errors: parse.error.flatten().fieldErrors,
      });
      return;
    }

    const id = `plan_${uuidv4().slice(0, 8)}`;
    await db.insert(commissionPlans).values({
      id,
      name: parse.data.name,
      description: parse.data.description,
      isDefault: parse.data.isDefault,
    });

    return reply.status(201).send({ id, ...parse.data });
  });

  /**
   * POST /api/v1/admin/commissions/rules
   */
  fastify.post("/rules", async (request, reply) => {
    const parse = createRuleSchema.safeParse(request.body);
    if (!parse.success) {
      reply.status(400).send({
        message: "Invalid commission rule",
        errors: parse.error.flatten().fieldErrors,
      });
      return;
    }

    const id = `rule_${uuidv4().slice(0, 8)}`;
    await db.insert(commissionRules).values({
      id,
      planId: parse.data.planId,
      ruleType: parse.data.ruleType,
      scope: parse.data.scope,
      scopeId: parse.data.scopeId,
      percentageRate: String(parse.data.percentageRate),
      fixedAmount: String(parse.data.fixedAmount),
      minCommission: parse.data.minCommission != null ? String(parse.data.minCommission) : null,
      maxCommission: parse.data.maxCommission != null ? String(parse.data.maxCommission) : null,
      priority: parse.data.priority,
      status: "ACTIVE",
    });

    return reply.status(201).send({ id, ...parse.data });
  });

  /**
   * PATCH /api/v1/admin/commissions/rules/:ruleId
   * Updates a rule with automatic immutable snapshot versioning.
   */
  fastify.patch("/rules/:ruleId", async (request, reply) => {
    const { ruleId } = request.params as { ruleId: string };
    const parse = updateRuleSchema.safeParse(request.body);
    if (!parse.success) {
      reply.status(400).send({
        message: "Invalid rule update payload",
        errors: parse.error.flatten().fieldErrors,
      });
      return;
    }

    const changedBy = (request.headers["x-user-id"] as string) || "admin";
    const result = await commissionService.updateRule(
      ruleId,
      {
        percentageRate: parse.data.percentageRate,
        fixedAmount: parse.data.fixedAmount,
        minCommission: parse.data.minCommission,
        maxCommission: parse.data.maxCommission,
        priority: parse.data.priority,
        status: parse.data.status,
      },
      changedBy,
      parse.data.changeReason,
    );

    return reply.status(200).send(result);
  });

  /**
   * GET /api/v1/admin/commissions/reports
   * High-level analytics and seller fee totals.
   */
  fastify.get("/reports", async (_request, reply) => {
    const report = await commissionService.getReports();
    return reply.status(200).send(report);
  });
}
