/**
 * @file mirror-worker.ts
 * @description Background daemon that listens to all Kafka DLQ topics
 * and indexes dead-letter events into OpenSearch in real-time.
 */

import type { Kafka, Consumer } from "kafkajs";
import {
  createOpenSearchClient,
  ensureDlqIndexExists,
  indexDlqRecord,
} from "@repo/opensearch";
import { parseKafkaHeaders } from "./inspector.js";
import type { DeadLetterRecord, DeadLetterStatus } from "./types.js";

export async function runDlqMirrorWorker(
  kafka: Kafka,
  opensearchNode?: string,
): Promise<void> {
  const node =
    opensearchNode ||
    process.env.OPENSEARCH_NODE ||
    process.env.OPENSEARCH_URL ||
    "http://localhost:9200";

  console.log(
    `\n📦 Initializing OpenSearch client for DLQ mirror at ${node}...`,
  );
  const osClient = createOpenSearchClient({
    node,
    rejectUnauthorized: false,
  });

  await ensureDlqIndexExists(osClient);

  const groupId = "larekmart-dlq-mirror-worker";
  const consumer: Consumer = kafka.consumer({
    groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  console.log(`📡 Connecting DLQ Mirror Consumer (Group: ${groupId})...`);
  await consumer.connect();

  // Subscribe to all DLQ topics via regex pattern
  await consumer.subscribe({
    topic: /\.dlq$/,
    fromBeginning: false,
  });

  console.log(
    `✅ DLQ Mirror Worker listening on pattern [/*.dlq$/] -> OpenSearch [larekmart-dlq-records]\n`,
  );

  let isStopping = false;

  const shutdown = async () => {
    if (isStopping) return;
    isStopping = true;
    console.log(`\n🛑 Shutting down DLQ Mirror Worker...`);
    try {
      await consumer.stop();
      await consumer.disconnect();
      console.log(`✅ DLQ Mirror Worker safely disconnected.`);
      process.exit(0);
    } catch (err) {
      console.error(`Error during DLQ mirror teardown:`, err);
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const offsetStr = message.offset;
        const headers = parseKafkaHeaders(
          message.headers as Record<string, Buffer | string | undefined>,
        );
        const rawPayload = message.value ? message.value.toString("utf-8") : "";

        let parsedPayload: Record<string, unknown> | null = null;
        try {
          parsedPayload = JSON.parse(rawPayload);
        } catch {
          // Keep null for poison pills
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

        const record: DeadLetterRecord = {
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
        };

        await indexDlqRecord(osClient, record as any);
        console.log(
          `📥 [Mirror] Indexed dead letter ${record.id} (${record.errorName}) into OpenSearch`,
        );
      } catch (err) {
        console.error(`❌ Failed to mirror DLQ message to OpenSearch:`, err);
      }
    },
  });
}
