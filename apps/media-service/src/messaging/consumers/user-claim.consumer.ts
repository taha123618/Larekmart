import { z } from "zod";
import type { MediaDb } from "../../db/client.js";
import { createMediaRepository } from "../../db/repositories/media.repository.js";
import { invalidateMedia } from "../../cache/media-cache.js";
import { mediaMetrics, logger } from "../../observability/metrics.js";

/**
 * User-media association consumer.
 *
 * user-service publishes `user.avatar_uploaded` (a `user.*` lifecycle event)
 * after the profile's avatarMediaId is persisted. media-service claims the
 * referenced media rows for the Clerk identity (`ownerType=user`,
 * `ownerId=authUserId`) — closing the ownership loop opened at upload time,
 * the same way the product-claim consumer does for products.
 *
 * Ownership uses the **Clerk authUserId**, not user-service's internal
 * user.id, because media-service authorizes user-owned media against the
 * verified Clerk session id (see MediaService.assertCanManage). The
 * `user.deleted` cleanup consumer must therefore receive/derive the same
 * authUserId for avatars to be cleaned up.
 *
 * Idempotent: claiming is a no-op when ownership already matches.
 */

const UserAvatarPayloadSchema = z.object({
  userId: z.string().min(1),
  authUserId: z.string().min(1).optional(),
  data: z
    .object({
      avatarMediaId: z.string().min(1).nullable().optional(),
    })
    .partial()
    .optional(),
});

/** Extracts a media id from a `media:<uuid>` ref or bare uuid. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeMediaRef(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const id = ref.startsWith("media:") ? ref.slice(6) : ref;
  return UUID_RE.test(id) ? id : null;
}

export async function handleUserAvatarClaim(
  rawMessage: unknown,
  database: MediaDb,
): Promise<void> {
  const envelope = rawMessage as { value?: unknown };
  const parsed = UserAvatarPayloadSchema.safeParse(
    envelope.value !== undefined ? envelope.value : rawMessage,
  );
  if (!parsed.success) {
    logger.warn("Ignoring malformed user.avatar_uploaded event for media claiming");
    return;
  }

  const { userId, authUserId } = parsed.data;
  const ownerRef = authUserId ?? userId;
  const avatarMediaId = normalizeMediaRef(parsed.data.data?.avatarMediaId);
  if (!avatarMediaId) return;

  const mediaRepo = createMediaRepository(database);
  const media = await mediaRepo.findByIdNotDeleted(avatarMediaId);
  if (!media) {
    logger.warn(
      `user.avatar_uploaded references unknown media ${avatarMediaId} for user ${ownerRef}`,
    );
    return;
  }

  if (media.ownerType === "user" && media.ownerId === ownerRef) {
    return; // already claimed — idempotent replay
  }

  await mediaRepo.updateOwner(media.id, "user", ownerRef);
  await invalidateMedia(media.id);
  mediaMetrics.kafka_events_consumed_total.inc({ event: "user.avatar_uploaded" });
  logger.info(`user.avatar_uploaded: claimed media ${media.id} for user/${ownerRef}`);
}
