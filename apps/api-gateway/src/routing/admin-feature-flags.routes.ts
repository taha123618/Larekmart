import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/authorization.js";
import { logger } from "../observability/logger.js";
import { featureFlagEngine } from "../utils/feature-flags.js";

const ruleOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "in",
  "not_in",
  "contains",
  "regex",
  "greater_than",
  "less_than",
]);

const featureFlagRuleSchema = z.object({
  id: z.string(),
  attribute: z.string(),
  operator: ruleOperatorSchema,
  values: z.array(z.union([z.string(), z.number(), z.boolean()])),
  variation: z.string().optional(),
  value: z.any().optional(),
});

const featureFlagRolloutSchema = z.object({
  percentage: z.number().min(0).max(100),
  stickinessAttribute: z.string().optional(),
  trueVariation: z.string().optional(),
  falseVariation: z.string().optional(),
});

const setFlagBodySchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  defaultValue: z.any(),
  variations: z.record(z.any()).optional(),
  defaultVariation: z.string().optional(),
  disabledVariation: z.string().optional(),
  rules: z.array(featureFlagRuleSchema).optional(),
  rollout: featureFlagRolloutSchema.optional(),
  description: z.string().optional(),
});

const toggleFlagBodySchema = z.object({
  enabled: z.boolean(),
});

const rolloutBodySchema = z.object({
  percentage: z.number().min(0).max(100),
});

const evaluateBodySchema = z.object({
  context: z
    .object({
      targetingKey: z.string().optional(),
      attributes: z.record(z.any()).optional(),
    })
    .optional(),
  defaultValue: z.any().optional(),
});

export const adminFeatureFlagsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/admin/feature-flags
   * Returns list of all registered feature flags.
   */
  fastify.get(
    "/api/v1/admin/feature-flags",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      try {
        const flags = await featureFlagEngine.listFlags();
        return reply.send({ success: true, count: flags.length, data: flags });
      } catch (err: any) {
        logger.error(`Failed to list feature flags: ${err.message}`);
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: "Failed to retrieve feature flags",
        });
      }
    },
  );

  /**
   * GET /api/v1/admin/feature-flags/:key
   * Retrieves single feature flag definition.
   */
  fastify.get(
    "/api/v1/admin/feature-flags/:key",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      try {
        const flag = await featureFlagEngine.getFlag(key);
        if (!flag) {
          return reply.status(404).send({
            statusCode: 404,
            error: "Not Found",
            message: `Feature flag '${key}' not found`,
          });
        }
        return reply.send({ success: true, data: flag });
      } catch (err: any) {
        logger.error(`Failed to get feature flag ${key}: ${err.message}`);
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: `Failed to fetch feature flag '${key}'`,
        });
      }
    },
  );

  /**
   * POST /api/v1/admin/feature-flags
   * Creates or updates a feature flag definition with atomic invalidation.
   */
  fastify.post(
    "/api/v1/admin/feature-flags",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parseResult = setFlagBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid feature flag schema",
          issues: parseResult.error.format(),
        });
      }

      try {
        await featureFlagEngine.setFlag({
          ...parseResult.data,
          defaultValue: parseResult.data.defaultValue ?? false,
        });
        logger.info(`Admin updated feature flag: ${parseResult.data.key}`, {
          adminUserId: request.authUserId,
          flagKey: parseResult.data.key,
          enabled: parseResult.data.enabled,
        });
        return reply.status(200).send({
          success: true,
          message: `Feature flag '${parseResult.data.key}' saved successfully`,
          data: parseResult.data,
        });
      } catch (err: any) {
        logger.error(`Failed to set feature flag: ${err.message}`);
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: "Failed to persist feature flag",
        });
      }
    },
  );

  /**
   * PATCH /api/v1/admin/feature-flags/:key/toggle
   * Quickly toggles flag enabled state.
   */
  fastify.patch(
    "/api/v1/admin/feature-flags/:key/toggle",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      const parseResult = toggleFlagBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Field 'enabled' (boolean) is required",
        });
      }

      try {
        const updated = await featureFlagEngine.toggleFlag(
          key,
          parseResult.data.enabled,
        );
        if (!updated) {
          return reply.status(404).send({
            statusCode: 404,
            error: "Not Found",
            message: `Feature flag '${key}' not found`,
          });
        }

        logger.info(`Admin toggled feature flag ${key} to ${parseResult.data.enabled}`, {
          adminUserId: request.authUserId,
          flagKey: key,
          enabled: parseResult.data.enabled,
        });

        return reply.send({
          success: true,
          message: `Feature flag '${key}' toggled to ${parseResult.data.enabled}`,
          enabled: parseResult.data.enabled,
        });
      } catch (err: any) {
        logger.error(`Failed to toggle feature flag ${key}: ${err.message}`);
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: `Failed to toggle feature flag '${key}'`,
        });
      }
    },
  );

  /**
   * PATCH /api/v1/admin/feature-flags/:key/rollout
   * Adjusts percentage canary rollout.
   */
  fastify.patch(
    "/api/v1/admin/feature-flags/:key/rollout",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      const parseResult = rolloutBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Field 'percentage' (number 0-100) is required",
        });
      }

      try {
        const updated = await featureFlagEngine.setRolloutPercentage(
          key,
          parseResult.data.percentage,
        );
        if (!updated) {
          return reply.status(404).send({
            statusCode: 404,
            error: "Not Found",
            message: `Feature flag '${key}' not found`,
          });
        }

        logger.info(
          `Admin updated canary rollout for ${key} to ${parseResult.data.percentage}%`,
          {
            adminUserId: request.authUserId,
            flagKey: key,
            percentage: parseResult.data.percentage,
          },
        );

        return reply.send({
          success: true,
          message: `Rollout percentage for '${key}' set to ${parseResult.data.percentage}%`,
          percentage: parseResult.data.percentage,
        });
      } catch (err: any) {
        logger.error(`Failed to update rollout for ${key}: ${err.message}`);
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: `Failed to update rollout for '${key}'`,
        });
      }
    },
  );

  /**
   * DELETE /api/v1/admin/feature-flags/:key
   * Deletes a feature flag from Redis.
   */
  fastify.delete(
    "/api/v1/admin/feature-flags/:key",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      try {
        const deleted = await featureFlagEngine.deleteFlag(key);
        if (!deleted) {
          return reply.status(404).send({
            statusCode: 404,
            error: "Not Found",
            message: `Feature flag '${key}' not found or already deleted`,
          });
        }

        logger.info(`Admin deleted feature flag: ${key}`, {
          adminUserId: request.authUserId,
          flagKey: key,
        });

        return reply.send({
          success: true,
          message: `Feature flag '${key}' deleted successfully`,
        });
      } catch (err: any) {
        logger.error(`Failed to delete feature flag ${key}: ${err.message}`);
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: `Failed to delete feature flag '${key}'`,
        });
      }
    },
  );

  /**
   * POST /api/v1/admin/feature-flags/:key/evaluate
   * Simulates/tests how a feature flag evaluates under arbitrary context.
   */
  fastify.post(
    "/api/v1/admin/feature-flags/:key/evaluate",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      const parseResult = evaluateBodySchema.safeParse(request.body ?? {});
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid evaluate request payload",
        });
      }

      const defaultVal = parseResult.data?.defaultValue ?? false;
      const context = parseResult.data?.context;

      try {
        const evaluation = await featureFlagEngine.evaluate(
          key,
          defaultVal,
          context,
        );
        return reply.send({ success: true, data: evaluation });
      } catch (err: any) {
        logger.error(`Failed to test evaluate ${key}: ${err.message}`);
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: `Evaluation simulation failed for '${key}'`,
        });
      }
    },
  );
};
