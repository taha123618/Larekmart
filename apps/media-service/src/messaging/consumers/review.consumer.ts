import type { MediaDb } from "../../db/client.js";
import { handleDomainDeleted } from "./domain-deletion.consumer.js";

/**
 * Review domain event consumer for media-service.
 * Handles review.deleted (soft-delete review images) idempotently.
 */
export async function handleReviewEvent(
  topic: string,
  rawMessage: unknown,
  database: MediaDb,
): Promise<void> {
  if (topic === "review.deleted") {
    await handleDomainDeleted(topic, rawMessage, database);
  }
}
