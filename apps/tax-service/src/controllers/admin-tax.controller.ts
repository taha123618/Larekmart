import type { FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuidv4 } from "uuid";
import {
  CreateTaxRuleSchema,
  UpdateTaxRuleSchema,
  CreateTaxJurisdictionSchema,
  CreateTaxCategorySchema,
  CreateTaxExemptionSchema,
} from "@repo/types";
import { taxRuleRepository } from "../repositories/tax-rule.repository.js";
import { jurisdictionRepository } from "../repositories/jurisdiction.repository.js";
import { taxCategoryRepository } from "../repositories/tax-category.repository.js";
import { taxExemptionRepository } from "../repositories/tax-exemption.repository.js";
import { taxCalculationRepository } from "../repositories/tax-calculation.repository.js";
import { taxEventProducer } from "../events/producers/tax.producer.js";
import { env } from "../config/env.js";

export class AdminTaxController {
  /**
   * POST /api/v1/admin/tax/rules
   */
  public static async createRule(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parseResult = CreateTaxRuleSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        message: "Invalid tax rule payload",
        errors: parseResult.error.format(),
      });
      return;
    }

    const data = parseResult.data;

    try {
      const created = await taxRuleRepository.create({
        id: uuidv4(),
        jurisdictionId: data.jurisdictionId,
        categoryId: data.categoryId,
        rate: data.rate,
        isInclusive: data.isInclusive,
        priority: data.priority,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        version: data.version,
        calculationMethod: data.calculationMethod,
        isActive: data.isActive,
      });

      // Publish Kafka event notification for rule update
      await taxEventProducer.publishTaxRulesUpdated({
        version: created.version,
        ruleIds: [created.id],
        timestamp: new Date().toISOString(),
      });

      reply.status(201).send(created);
    } catch (err) {
      request.log.error(err, "Failed to create tax rule");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to create tax rule",
      });
    }
  }

  /**
   * PATCH /api/v1/admin/tax/rules/:ruleId
   */
  public static async updateRule(
    request: FastifyRequest<{ Params: { ruleId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { ruleId } = request.params;
    const parseResult = UpdateTaxRuleSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        message: "Invalid tax rule update payload",
        errors: parseResult.error.format(),
      });
      return;
    }

    const data = parseResult.data;

    try {
      const existing = await taxRuleRepository.findById(ruleId);
      if (!existing) {
        reply.status(404).send({ message: `Tax rule '${ruleId}' not found` });
        return;
      }

      const updated = await taxRuleRepository.update(ruleId, {
        ...(data.rate !== undefined && { rate: data.rate }),
        ...(data.isInclusive !== undefined && {
          isInclusive: data.isInclusive,
        }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.effectiveFrom && {
          effectiveFrom: new Date(data.effectiveFrom),
        }),
        ...(data.effectiveTo !== undefined && {
          effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        }),
        ...(data.version && { version: data.version }),
        ...(data.calculationMethod && {
          calculationMethod: data.calculationMethod,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      });

      // Publish Kafka event notification for rule update
      await taxEventProducer.publishTaxRulesUpdated({
        version: updated?.version || existing.version,
        ruleIds: [ruleId],
        timestamp: new Date().toISOString(),
      });

      reply.status(200).send(updated);
    } catch (err) {
      request.log.error(err, "Failed to update tax rule");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to update tax rule",
      });
    }
  }

  /**
   * POST /api/v1/admin/tax/rules/:ruleId/activate
   */
  public static async activateRule(
    request: FastifyRequest<{ Params: { ruleId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { ruleId } = request.params;

    try {
      const existing = await taxRuleRepository.findById(ruleId);
      if (!existing) {
        reply.status(404).send({ message: `Tax rule '${ruleId}' not found` });
        return;
      }

      const activated = await taxRuleRepository.activate(ruleId);

      // Publish Kafka event notification
      await taxEventProducer.publishTaxRulesUpdated({
        version: activated?.version || existing.version,
        ruleIds: [ruleId],
        timestamp: new Date().toISOString(),
      });

      reply.status(200).send(activated);
    } catch (err) {
      request.log.error(err, "Failed to activate tax rule");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to activate tax rule",
      });
    }
  }

  /**
   * POST /api/v1/admin/tax/jurisdictions
   */
  public static async createJurisdiction(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parseResult = CreateTaxJurisdictionSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        message: "Invalid jurisdiction payload",
        errors: parseResult.error.format(),
      });
      return;
    }

    const data = parseResult.data;

    try {
      const created = await jurisdictionRepository.create({
        id: uuidv4(),
        countryCode: data.countryCode,
        regionCode: data.regionCode,
        municipality: data.municipality,
        jurisdictionCode: data.jurisdictionCode,
        name: data.name,
        isActive: data.isActive,
      });

      reply.status(201).send(created);
    } catch (err) {
      request.log.error(err, "Failed to create jurisdiction");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to create jurisdiction",
      });
    }
  }

  /**
   * POST /api/v1/admin/tax/categories
   */
  public static async createCategory(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parseResult = CreateTaxCategorySchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        message: "Invalid category payload",
        errors: parseResult.error.format(),
      });
      return;
    }

    const data = parseResult.data;

    try {
      const created = await taxCategoryRepository.create({
        id: uuidv4(),
        code: data.code,
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      });

      reply.status(201).send(created);
    } catch (err) {
      request.log.error(err, "Failed to create tax category");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to create tax category",
      });
    }
  }

  /**
   * POST /api/v1/admin/tax/exemptions
   */
  public static async createExemption(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parseResult = CreateTaxExemptionSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        message: "Invalid exemption payload",
        errors: parseResult.error.format(),
      });
      return;
    }

    const data = parseResult.data;

    try {
      const created = await taxExemptionRepository.create({
        id: uuidv4(),
        customerId: data.customerId,
        exemptionCertificate: data.exemptionCertificate,
        exemptionType: data.exemptionType,
        jurisdictionId: data.jurisdictionId,
        validFrom: new Date(data.validFrom),
        validTo: data.validTo ? new Date(data.validTo) : null,
        isActive: data.isActive,
      });

      reply.status(201).send(created);
    } catch (err) {
      request.log.error(err, "Failed to create tax exemption");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to create tax exemption",
      });
    }
  }

  /**
   * GET /api/v1/admin/tax/overview
   */
  public static async getOverview(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const [jurisdictions, rules, categories, calculations] =
        await Promise.all([
          jurisdictionRepository.findAll(),
          taxRuleRepository.findAll(),
          taxCategoryRepository.findAll(),
          taxCalculationRepository.findAll(100),
        ]);

      const activeRules = rules.filter((r) => r.isActive).length;

      reply.status(200).send({
        totalJurisdictions: jurisdictions.length,
        activeRules,
        totalCategories: categories.length,
        totalCalculations: calculations.length,
        provider: env.TAX_PROVIDER,
      });
    } catch (err) {
      request.log.error(err, "Failed to fetch tax overview");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to fetch tax overview",
      });
    }
  }

  /**
   * GET /api/v1/admin/tax/rules
   */
  public static async getRules(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const [rules, jurisdictions, categories] = await Promise.all([
        taxRuleRepository.findAll(),
        jurisdictionRepository.findAll(),
        taxCategoryRepository.findAll(),
      ]);

      const jurMap = new Map(jurisdictions.map((j) => [j.id, j.name]));
      const catMap = new Map(categories.map((c) => [c.id, c.name]));

      const enrichedRules = rules.map((r) => ({
        ...r,
        jurisdictionName: jurMap.get(r.jurisdictionId) ?? r.jurisdictionId,
        categoryName: catMap.get(r.categoryId) ?? r.categoryId,
      }));

      reply.status(200).send(enrichedRules);
    } catch (err) {
      request.log.error(err, "Failed to fetch tax rules");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to fetch tax rules",
      });
    }
  }

  /**
   * DELETE /api/v1/admin/tax/rules/:ruleId
   */
  public static async deleteRule(
    request: FastifyRequest<{ Params: { ruleId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { ruleId } = request.params;
    try {
      const updated = await taxRuleRepository.update(ruleId, {
        isActive: false,
      });
      if (!updated) {
        reply.status(404).send({ message: `Tax rule '${ruleId}' not found` });
        return;
      }
      reply
        .status(200)
        .send({ message: "Tax rule deactivated successfully", ruleId });
    } catch (err) {
      request.log.error(err, "Failed to deactivate tax rule");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to deactivate tax rule",
      });
    }
  }

  /**
   * GET /api/v1/admin/tax/exemptions
   */
  public static async getExemptions(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const exemptions = await taxExemptionRepository.findAll();
      reply.status(200).send(exemptions);
    } catch (err) {
      request.log.error(err, "Failed to fetch tax exemptions");
      reply.status(500).send({
        message:
          err instanceof Error ? err.message : "Failed to fetch tax exemptions",
      });
    }
  }

  /**
   * GET /api/v1/admin/tax/calculations
   */
  public static async getCalculations(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const calculations = await taxCalculationRepository.findAll(50);
      reply.status(200).send(calculations);
    } catch (err) {
      request.log.error(err, "Failed to fetch tax calculations");
      reply.status(500).send({
        message:
          err instanceof Error
            ? err.message
            : "Failed to fetch tax calculations",
      });
    }
  }
}
