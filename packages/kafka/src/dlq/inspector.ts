/**
 * @file inspector.ts
 * @description Dynamic Kafka watermark inspector and DLQ message extractor.
 */

import type { Kafka, Admin, Consumer } from "kafkajs";
import type {
  DeadLetterRecord,
  DeadLetterStatus,
  DlqTopicSummary,
} from "./types.js";

/**
 * Discover all DLQ topics currently provisioned on the cluster.
 */
export async function discoverDlqTopics(kafkaAdmin: Admin): Promise<string[]> {
  const topics = await kafkaAdmin.listTopics();
  return topics.filter((t) => t.endsWith(".dlq") && !t.endsWith(".dlq.parked"));
}

/**
 * Retrieve watermark summaries (message counts, partition offsets) for DLQ topics.
 */
export async function getDlqTopicSummaries(
  kafkaAdmin: Admin,
  topicFilter?: string,
): Promise<DlqTopicSummary[]> {
  const allDlqTopics = await discoverDlqTopics(kafkaAdmin);
  const targets = topicFilter
    ? allDlqTopics.filter((t) => t.includes(topicFilter))
    : allDlqTopics;

  const summaries: DlqTopicSummary[] = [];

  for (const topic of targets) {
    try {
      const topicOffsets = await kafkaAdmin.fetchTopicOffsets(topic);
      let totalMessages = 0;
      let minOffset = Number.MAX_SAFE_INTEGER;
      let maxOffset = 0;

      for (const po of topicOffsets) {
        const high = parseInt(po.high, 10) || 0;
        const low = parseInt(po.low, 10) || 0;
        const count = Math.max(0, high - low);
        totalMessages += count;
        if (low < minOffset) minOffset = low;
        if (high > maxOffset) maxOffset = high;
      }

      summaries.push({
        topic,
        originalTopic: topic.replace(/\.dlq$/, ""),
        partitions: topicOffsets.length,
        totalMessages,
        oldestOffset:
          minOffset === Number.MAX_SAFE_INTEGER ? "0" : String(minOffset),
        latestOffset: String(maxOffset),
      });
    } catch {
      // Continue on non-fatal inspection error for individual topic
    }
  }

  return summaries;
}

/**
 * Parse headers from a KafkaJS message into a typed key-value record.
 */
export function parseKafkaHeaders(
  rawHeaders?: Record<string, Buffer | string | undefined>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!rawHeaders) return headers;

  for (const [key, val] of Object.entries(rawHeaders)) {
    if (val === undefined || val === null) continue;
    headers[key] = Buffer.isBuffer(val) ? val.toString("utf-8") : String(val);
  }

  return headers;
}

/**
 * Fetch a batch of dead letter records from a specific DLQ topic without committing consumer offsets.
 */
export async function fetchDlqRecords(
  kafka: Kafka,
  options: {
    topic: string;
    limit?: number;
    partition?: number;
    timeoutMs?: number;
  },
): Promise<DeadLetterRecord[]> {
  const limit = options.limit ?? 50;
  const timeoutMs = options.timeoutMs ?? 4000;
  const tempGroupId = `dlq-inspector-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const consumer: Consumer = kafka.consumer({
    groupId: tempGroupId,
    sessionTimeout: 10000,
    heartbeatInterval: 3000,
  });

  const records: DeadLetterRecord[] = [];

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: options.topic, fromBeginning: true });

    let collected = 0;
    const fetchPromise = new Promise<void>((resolve) => {
      consumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
          if (
            options.partition !== undefined &&
            partition !== options.partition
          ) {
            return;
          }

          const offsetStr = message.offset;
          const headers = parseKafkaHeaders(
            message.headers as Record<string, Buffer | string | undefined>,
          );
          const rawPayload = message.value
            ? message.value.toString("utf-8")
            : "";

          let parsedPayload: Record<string, unknown> | null = null;
          try {
            parsedPayload = JSON.parse(rawPayload);
          } catch {
            // Raw string remains for poison pills
          }

          const originalTopic =
            headers["x-original-topic"] || topic.replace(/\.dlq$/, "");
          const replayCount = parseInt(
            headers["x-larekmart-replay-count"] || "0",
            10,
          );
          const isPoisonPill = headers["x-is-poison-pill"] === "true";
          const attemptCount = parseInt(headers["x-attempt-count"] || "1", 10);

          let status: DeadLetterStatus = "PENDING";
          if (headers["x-larekmart-replayed-at"]) {
            status = "REPLAYED";
          }

          records.push({
            id: `${topic}-${partition}-${offsetStr}`,
            originalTopic,
            dlqTopic: topic,
            partition,
            offset: offsetStr,
            key: message.key ? message.key.toString("utf-8") : null,
            rawPayload,
            parsedPayload,
            errorMessage: headers["x-error-message"] || "Unknown error",
            errorName: headers["x-error-name"] || "Error",
            errorStack: headers["x-error-stack"] || "",
            attemptCount,
            isPoisonPill,
            consumerGroup: headers["x-consumer-group"] || "unknown",
            failedAt: headers["x-failed-at"] || new Date().toISOString(),
            replayCount,
            status,
            replayedAt: headers["x-larekmart-replayed-at"],
            replayedBy: headers["x-larekmart-replayed-by"],
            payloadModified: headers["x-larekmart-payload-modified"] === "true",
          });

          collected++;
          if (collected >= limit) {
            resolve();
          }
        },
      });
    });

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    });

    await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    try {
      await consumer.stop();
      await consumer.disconnect();
    } catch {
      // Ignore teardown errors on temp inspection consumer
    }
  }

  // Return newest records first
  return records.reverse();
}
