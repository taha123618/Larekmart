/**
 * @file replayer.ts
 * @description Guarded Kafka Dead-Letter Queue (DLQ) replay engine with
 * cyclic loop protection, header enrichment, and payload fix support.
 */

import type { Kafka, Producer } from "kafkajs";
import type { DeadLetterRecord, ReplayOptions, ReplayResult } from "./types.js";

const DEFAULT_MAX_REPLAY_THRESHOLD = 3;

/**
 * Replay a dead letter message with safety guards and provenance headers.
 */
export async function replayDeadLetter(
  kafka: Kafka,
  record: DeadLetterRecord,
  options: ReplayOptions,
): Promise<ReplayResult> {
  const threshold = options.maxReplayThreshold ?? DEFAULT_MAX_REPLAY_THRESHOLD;
  const currentCount = record.replayCount || 0;
  const nextReplayCount = currentCount + 1;

  const isTerminalGraveyard = nextReplayCount > threshold;
  const targetTopic = isTerminalGraveyard
    ? `${record.originalTopic}.dlq.parked`
    : options.targetTopic || record.originalTopic;

  const payloadToSend =
    options.modifiedPayload !== undefined
      ? options.modifiedPayload
      : record.rawPayload;

  const payloadModified =
    options.modifiedPayload !== undefined &&
    options.modifiedPayload !== record.rawPayload;

  const producer: Producer = kafka.producer({
    allowAutoTopicCreation: true,
  });

  const nowIso = new Date().toISOString();

  try {
    await producer.connect();

    await producer.send({
      topic: targetTopic,
      messages: [
        {
          key: record.key ? Buffer.from(record.key) : undefined,
          value: Buffer.from(payloadToSend),
          headers: {
            "x-original-topic": record.originalTopic,
            "x-original-partition": String(record.partition),
            "x-original-offset": record.offset,
            "x-consumer-group": record.consumerGroup,
            "x-error-message": record.errorMessage,
            "x-error-name": record.errorName,
            "x-is-poison-pill": String(record.isPoisonPill),
            "x-larekmart-replay-count": String(nextReplayCount),
            "x-larekmart-replayed-by": options.replayedBy,
            "x-larekmart-replayed-at": nowIso,
            "x-larekmart-payload-modified": String(payloadModified),
            ...(isTerminalGraveyard
              ? { "x-larekmart-parked-reason": "EXCEEDED_MAX_REPLAY_THRESHOLD" }
              : {}),
          },
        },
      ],
    });

    return {
      success: true,
      recordId: record.id,
      originalTopic: record.originalTopic,
      targetTopic,
      partition: record.partition,
      offset: record.offset,
      replayCount: nextReplayCount,
      routedToGraveyard: isTerminalGraveyard,
      timestamp: nowIso,
      replayedBy: options.replayedBy,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      recordId: record.id,
      originalTopic: record.originalTopic,
      targetTopic,
      partition: record.partition,
      offset: record.offset,
      replayCount: currentCount,
      routedToGraveyard: false,
      timestamp: nowIso,
      replayedBy: options.replayedBy,
      error: errorMsg,
    };
  } finally {
    try {
      await producer.disconnect();
    } catch {
      // Producer disconnect cleanup
    }
  }
}

/**
 * Replay multiple dead letter messages using a single connected producer.
 */
export async function replayDeadLettersBatch(
  kafka: Kafka,
  records: DeadLetterRecord[],
  options: {
    replayedBy: string;
    maxReplayThreshold?: number;
    targetTopic?: string;
  },
): Promise<ReplayResult[]> {
  const producer: Producer = kafka.producer({
    allowAutoTopicCreation: true,
  });

  const results: ReplayResult[] = [];
  const threshold = options.maxReplayThreshold ?? DEFAULT_MAX_REPLAY_THRESHOLD;

  try {
    await producer.connect();

    for (const record of records) {
      const currentCount = record.replayCount || 0;
      const nextReplayCount = currentCount + 1;
      const isTerminalGraveyard = nextReplayCount > threshold;
      const targetTopic = isTerminalGraveyard
        ? `${record.originalTopic}.dlq.parked`
        : options.targetTopic || record.originalTopic;
      const nowIso = new Date().toISOString();

      try {
        await producer.send({
          topic: targetTopic,
          messages: [
            {
              key: record.key ? Buffer.from(record.key) : undefined,
              value: Buffer.from(record.rawPayload),
              headers: {
                "x-original-topic": record.originalTopic,
                "x-original-partition": String(record.partition),
                "x-original-offset": record.offset,
                "x-consumer-group": record.consumerGroup,
                "x-error-message": record.errorMessage,
                "x-error-name": record.errorName,
                "x-is-poison-pill": String(record.isPoisonPill),
                "x-larekmart-replay-count": String(nextReplayCount),
                "x-larekmart-replayed-by": options.replayedBy,
                "x-larekmart-replayed-at": nowIso,
                "x-larekmart-payload-modified": "false",
                ...(isTerminalGraveyard
                  ? { "x-larekmart-parked-reason": "EXCEEDED_MAX_REPLAY_THRESHOLD" }
                  : {}),
              },
            },
          ],
        });

        results.push({
          success: true,
          recordId: record.id,
          originalTopic: record.originalTopic,
          targetTopic,
          partition: record.partition,
          offset: record.offset,
          replayCount: nextReplayCount,
          routedToGraveyard: isTerminalGraveyard,
          timestamp: nowIso,
          replayedBy: options.replayedBy,
        });
      } catch (err) {
        results.push({
          success: false,
          recordId: record.id,
          originalTopic: record.originalTopic,
          targetTopic,
          partition: record.partition,
          offset: record.offset,
          replayCount: currentCount,
          routedToGraveyard: false,
          timestamp: nowIso,
          replayedBy: options.replayedBy,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    try {
      await producer.disconnect();
    } catch {
      // Cleanup
    }
  }

  return results;
}
