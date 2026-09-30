import { z } from "zod";
import { DomainDeletedPayloadSchema } from "@repo/types";
import type { MediaDb } from "../../db/client.js";
import { createMediaRepository } from "../../db/repositories/media.repository.js";
import { createEventRepository } from "../../db/repositories/event.repository.js";
import { publishMediaEvent } from "../publishers/media.publisher.js";
import { mediaMetrics, logger } from "../../observability/metrics.js";
import { invalidateMedia } from "../../cache/media-cache.js";

/**
 * Domain-cleanup consumer (spec sections 21–22).
 *
 * product.deleted / seller.deleted / review.deleted / user.deleted /
 * category.deleted / brand.deleted → soft-delete (never hard-delete) the
 * associated media, retaining binaries for the purge window / recovery.
 *
 * Idempotency: every event id is checked against `processed_events` before
 * any side effect; duplicates are ignored. Media id is used as the event id
 * when a producer doesn't send one (deduplication over owner+event).
 */
export async function handleDomainDeleted(
  topic: string,
  rawMessage: unknown,
  database: MediaDb,
): Promise<boolean> {
  const parsed = DomainDeletedPayloadSchema.safeParse(rawMessage);
  if (!parsed.success) {
    logger.warn(
      `Ignoring malformed ${topic} event: ${JSON.stringify(parsed.error.issues)}`,
    );
    return false;
  }

  const payload = parsed.data;
  const ownerId = extractOwnerId(payload);
  if (!ownerId) {
    logger.info(`${topic} event without extractable owner id, ignoring`);
    return false;
  }

  const ownerType = topic.split(".")[0] ?? topic;
  const eventId = extractEventId(payload, topic, ownerType, ownerId);

  const events = createEventRepository(database);

  // Idempotency gate: duplicate delivery must not re-delete or corrupt state.
  if (await events.isProcessed(eventId)) {
    logger.info(`Event ${eventId} already processed, ignoring`);
    return false;
  }

  const mediaRepo = createMediaRepository(database);
  const associated = await mediaRepo.list({
    ownerType,
    ownerId,
    limit: 500,
    offset: 0,
  });

  let deleted = 0;
  for (const media of associated.items) {
    const softDeleted = await mediaRepo.softDelete(media.id);
    if (softDeleted) {
      deleted += 1;
      await invalidateMedia(media.id);
      await publishMediaEvent("media.deleted", {
        mediaId: media.id,
        ownerType: media.ownerType,
        ownerId: media.ownerId,
      });
    }
  }

  await events.markProcessed(eventId, topic);
  mediaMetrics.kafka_events_consumed_total.inc({ event: topic });
  logger.info(
    `${topic}: soft-deleted ${deleted} media for ${ownerType}/${ownerId}`,
  );
  return true;
}

function extractOwnerId(
  payload: z.infer<typeof DomainDeletedPayloadSchema>,
): string | null {
  if (typeof payload === "number") return String(payload);
  if (typeof payload === "string") return payload;
  if ("id" in payload && payload.id !== undefined) return String(payload.id);
  if ("productId" in payload && payload.productId !== undefined)
    return String(payload.productId);
  if ("sellerId" in payload && payload.sellerId !== undefined)
    return String(payload.sellerId);
  if ("reviewId" in payload && payload.reviewId !== undefined)
    return String(payload.reviewId);
  if ("categoryId" in payload && payload.categoryId !== undefined)
    return String(payload.categoryId);
  if ("brandId" in payload && payload.brandId !== undefined)
    return String(payload.brandId);
  if ("userId" in payload && payload.userId !== undefined)
    return payload.userId;
  return null;
}

function extractEventId(
  payload: z.infer<typeof DomainDeletedPayloadSchema>,
  topic: string,
  ownerType: string,
  ownerId: string,
): string {
  if (typeof payload === "object" && "eventId" in payload && payload.eventId) {
    return payload.eventId;
  }
  // Deterministic id from owner+topic: replays of the same deletion are
  // deduplicated even when the producer sends no event id.
  return `${topic}:${ownerType}:${ownerId}`;
}

type KafkaConsumerHandle = {
  subscribe: (
    topics: {
      topicName: string;
      topicHandler: (message: unknown) => Promise<void>;
    }[],
  ) => Promise<void>;
};

/** Subscribes the media-service consumer to all cleanup topics. */
export async function startDomainDeletionConsumer(
  kafkaConsumerRef: KafkaConsumerHandle,
  database: MediaDb,
): Promise<void> {
  const topics = [
    "product.deleted",
    "seller.deleted",
    "review.deleted",
    "user.deleted",
    "category.deleted",
    "brand.deleted",
  ];

  await kafkaConsumerRef.subscribe(
    topics.map((topicName) => ({
      topicName,
      topicHandler: async (message: unknown) => {
        // The @repo/kafka wrapper passes the parsed envelope { value: payload }.
        const envelope = message as { value?: unknown };
        try {
          await handleDomainDeleted(
            topicName,
            envelope.value ?? envelope,
            database,
          );
        } catch (error) {
          // Logged, never thrown — one bad event must not kill the loop.
          logger.error(`Failed handling ${topicName}`, error);
        }
      },
    })),
  );
}
