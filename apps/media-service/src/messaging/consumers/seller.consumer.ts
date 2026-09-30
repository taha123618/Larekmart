import type { MediaDb } from "../../db/client.js";
import { handleDomainDeleted } from "./domain-deletion.consumer.js";

/**
 * Seller domain event consumer for media-service.
 * Handles seller.deleted (soft-delete seller media/documents) idempotently.
 */
export async function handleSellerEvent(
  topic: string,
  rawMessage: unknown,
  database: MediaDb,
): Promise<void> {
  if (topic === "seller.deleted") {
    await handleDomainDeleted(topic, rawMessage, database);
  }
}
