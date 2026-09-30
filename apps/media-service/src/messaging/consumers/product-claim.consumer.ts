import { z } from "zod";
import type { MediaDb } from "../../db/client.js";
import { createMediaRepository } from "../../db/repositories/media.repository.js";
import { createEventRepository } from "../../db/repositories/event.repository.js";
import { invalidateMedia } from "../../cache/media-cache.js";
import { mediaMetrics, logger } from "../../observability/metrics.js";

/**
 * Product-media association consumer.
 *
 * When product-service publishes `product.created` / `product.updated` with
 * `images` referencing media ids (`color → "media:<uuid>"`), media-service
 * claims those media rows for the product:
 *   ownerType = "product", ownerId = String(product.id)
 *
 * This closes the ownership loop opened at upload time (the admin uploads a
 * draft before the product exists) and makes the existing `product.deleted`
 * cleanup consumer authoritative. Idempotent via `processed_events`.
 */

import { parseMediaReferences, extractMediaId } from "@repo/types";

const ProductImagesPayloadSchema = z.object({
  id: z.union([z.number(), z.string()]),
  images: z.unknown().nullable().optional(),
});

/** Extracts media refs from the mixed `images` JSON products store. */
export function extractMediaIds(images: unknown): string[] {
  if (typeof images !== "object" || images === null) return [];
  const values = Object.values(images as Record<string, unknown>);
  return values.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

export async function handleProductMediaClaim(
  topic: string,
  rawMessage: unknown,
  database: MediaDb,
): Promise<void> {
  // The @repo/kafka wrapper passes the parsed envelope { value: payload }.
  const envelope = rawMessage as { value?: unknown };
  const parsed = ProductImagesPayloadSchema.safeParse(
    envelope.value !== undefined ? envelope.value : rawMessage,
  );
  if (!parsed.success) {
    logger.warn(`Ignoring malformed ${topic} event for media claiming`);
    return;
  }

  const { id, images } = parsed.data;
  const productId = String(id);
  const mediaIds = parseMediaReferences(images);
  if (mediaIds.length === 0) return;

  const eventId = `${topic}:media-claim:${productId}:${
    topic === "product.updated" ? Date.now() : "created"
  }`;
  const events = createEventRepository(database);
  if (topic === "product.created" && (await events.isProcessed(eventId))) {
    return;
  }

  const mediaRepo = createMediaRepository(database);
  let claimed = 0;
  for (const mediaId of mediaIds) {
    const media = await mediaRepo.findByIdNotDeleted(mediaId);
    if (!media) continue;
    if (media.ownerType === "product" && media.ownerId === productId) continue;
    await mediaRepo.updateOwner(media.id, "product", productId);
    claimed += 1;
    await invalidateMedia(media.id);
  }

  if (topic === "product.created") {
    await events.markProcessed(eventId, topic);
  }
  mediaMetrics.kafka_events_consumed_total.inc({ event: topic });
  if (claimed > 0) {
    logger.info(`${topic}: claimed ${claimed} media for product/${productId}`);
  }
}
