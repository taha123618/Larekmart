import type { MediaDb } from "../../db/client.js";
import { handleDomainDeleted } from "./domain-deletion.consumer.js";
import { handleUserAvatarClaim } from "./user-claim.consumer.js";

/**
 * User domain event consumer for media-service.
 * Handles user.deleted (cleanup) and user.avatar_uploaded (avatar media association).
 */
export async function handleUserEvent(
  topic: string,
  rawMessage: unknown,
  database: MediaDb,
): Promise<void> {
  if (topic === "user.deleted") {
    await handleDomainDeleted(topic, rawMessage, database);
  } else if (topic === "user.avatar_uploaded") {
    await handleUserAvatarClaim(rawMessage, database);
  }
}

export { handleUserAvatarClaim };
