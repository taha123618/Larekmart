import type { MediaDb } from "../../db/client.js";
import { handleDomainDeleted } from "./domain-deletion.consumer.js";
import { handleProductMediaClaim } from "./product-claim.consumer.js";

/**
 * Product domain event consumer for media-service.
 * Handles product.deleted (cleanup) and product.created / product.updated (media association).
 */
export async function handleProductEvent(
  topic: string,
  rawMessage: unknown,
  database: MediaDb,
): Promise<void> {
  if (topic === "product.deleted") {
    await handleDomainDeleted(topic, rawMessage, database);
  } else if (topic === "product.created" || topic === "product.updated") {
    await handleProductMediaClaim(topic, rawMessage, database);
  }
}

export { handleProductMediaClaim };
