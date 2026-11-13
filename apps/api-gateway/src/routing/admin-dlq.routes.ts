import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/authorization.js";
import { logger } from "../observability/logger.js";
import {
  createKafkaClient,
  getDlqTopicSummaries,
  fetchDlqRecords,
  replayDeadLetter,
  type DeadLetterRecord,
} from "@repo/kafka";
import {
  createOpenSearchClient,
  searchDlqRecords,
  type DlqSearchParams,
} from "@repo/opensearch";

const replayBodySchema = z.object({
  recordId: z.string(),
  dlqTopic: z.string(),
  partition: z.number().int().min(0),
  offset: z.string(),
  targetTopic: z.string().optional(),
  modifiedPayload: z.string().optional(),
  maxReplayThreshold: z.number().int().min(1).max(10).optional(),
});

export const adminDlqRoutes: FastifyPluginAsync = async (fastify) => {
  const kafka = createKafkaClient("gateway-dlq-ops");

  const opensearchHost =
    process.env.OPENSEARCH_NODE ||
    process.env.OPENSEARCH_URL ||
    "http://localhost:9200";
  const opensearchClient = createOpenSearchClient({
    node: opensearchHost,
    rejectUnauthorized: false,
  });

  /**
   * GET /api/v1/admin/dlq/topics
   * Returns list of all dead-letter topics with live backlog counts.
   */
  fastify.get(
    "/api/v1/admin/dlq/topics",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const admin = kafka.admin();
      try {
        await admin.connect();
        const summaries = await getDlqTopicSummaries(admin);
        return reply.send({
          success: true,
          data: summaries,
          count: summaries.length,
        });
      } catch (err) {
        logger.error("Failed to fetch DLQ topic summaries", {
          error: String(err),
        });
        return reply.status(500).send({
          success: false,
          message: "Failed to inspect Kafka DLQ topics",
          error: String(err),
        });
      } finally {
        await admin.disconnect().catch(() => {});
      }
    },
  );

  /**
   * GET /api/v1/admin/dlq/records
   * Returns paginated search of dead letters from OpenSearch, with Kafka fallback.
   */
  fastify.get(
    "/api/v1/admin/dlq/records",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const topic = query.topic;
      const status = query.status as any;
      const queryText = query.q || query.query;
      const isPoisonPill =
        query.isPoisonPill === "true"
          ? true
          : query.isPoisonPill === "false"
            ? false
            : undefined;
      const page = parseInt(query.page || "1", 10);
      const limit = parseInt(query.limit || "20", 10);

      try {
        // 1. Primary: Query OpenSearch indexed records
        const searchParams: DlqSearchParams = {
          topic,
          status,
          isPoisonPill,
          query: queryText,
          page,
          limit,
        };

        const osResult = await searchDlqRecords(
          opensearchClient,
          searchParams,
          logger,
        );
        if (osResult.records.length > 0) {
          return reply.send({
            success: true,
            source: "opensearch",
            ...osResult,
          });
        }

        // 2. Fallback: If OpenSearch is empty and topic is provided, scan Kafka partition
        if (topic) {
          const directRecords = await fetchDlqRecords(kafka, {
            topic: topic.endsWith(".dlq") ? topic : `${topic}.dlq`,
            limit,
          });

          return reply.send({
            success: true,
            source: "kafka-watermark",
            records: directRecords,
            total: directRecords.length,
            page: 1,
            limit,
            totalPages: 1,
          });
        }

        return reply.send({
          success: true,
          source: "empty",
          records: [],
          total: 0,
          page: 1,
          limit,
          totalPages: 1,
        });
      } catch (err) {
        logger.error("Failed to search DLQ records", { error: String(err) });
        return reply.status(500).send({
          success: false,
          message: "Failed to query dead-letter records",
          error: String(err),
        });
      }
    },
  );

  /**
   * POST /api/v1/admin/dlq/replay
   * Replays a dead letter to its original topic with provenance headers.
   */
  fastify.post(
    "/api/v1/admin/dlq/replay",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = replayBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          message: "Invalid replay request payload",
          errors: parsed.error.format(),
        });
      }

      const body = parsed.data;
      const replayedBy = `admin:${request.authUserId || "system"}`;

      try {
        // Fetch record to verify existence and extract original metadata
        const records = await fetchDlqRecords(kafka, {
          topic: body.dlqTopic,
          partition: body.partition,
          limit: 100,
        });

        let targetRecord = records.find((r) => r.offset === body.offset);
        if (!targetRecord) {
          // Construct record from request if older than fetch window
          targetRecord = {
            id: body.recordId,
            originalTopic: body.dlqTopic.replace(/\.dlq$/, ""),
            dlqTopic: body.dlqTopic,
            partition: body.partition,
            offset: body.offset,
            key: null,
            rawPayload: body.modifiedPayload || "{}",
            errorMessage: "Replayed via Admin Control Center",
            errorName: "ManualReplay",
            errorStack: "",
            attemptCount: 1,
            isPoisonPill: false,
            consumerGroup: "admin-replayer",
            failedAt: new Date().toISOString(),
            replayCount: 0,
            status: "PENDING",
          };
        }

        const result = await replayDeadLetter(kafka, targetRecord, {
          recordId: body.recordId,
          dlqTopic: body.dlqTopic,
          partition: body.partition,
          offset: body.offset,
          targetTopic: body.targetTopic,
          modifiedPayload: body.modifiedPayload,
          replayedBy,
          maxReplayThreshold: body.maxReplayThreshold ?? 3,
        });

        if (!result.success) {
          return reply.status(500).send({
            success: false,
            message: "Replay failed in Kafka producer",
            error: result.error,
          });
        }

        logger.info("Admin executed DLQ replay", {
          recordId: result.recordId,
          targetTopic: result.targetTopic,
          replayedBy: result.replayedBy,
          routedToGraveyard: result.routedToGraveyard,
        });

        return reply.send({
          success: true,
          message: result.routedToGraveyard
            ? "Record exceeded max replays and was routed to graveyard (.dlq.parked)"
            : "Record successfully replayed to target topic",
          data: result,
        });
      } catch (err) {
        logger.error("Error executing DLQ replay", { error: String(err) });
        return reply.status(500).send({
          success: false,
          message: "Internal error during replay execution",
          error: String(err),
        });
      }
    },
  );
};
