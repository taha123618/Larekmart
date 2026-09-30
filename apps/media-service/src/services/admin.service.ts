import { env } from "../config/env.js";
import { NotFoundError } from "../errors/errors.js";
import type { MediaRow } from "../db/repositories/media.repository.js";
import type { ProcessingJobRow } from "../db/repositories/upload.repository.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import { publishMediaEvent } from "../messaging/publishers/media.publisher.js";
import { invalidateMedia } from "../cache/media-cache.js";

/**
 * Administrative operations. Every path here is admin-gated at the route
 * layer (shouldBeAdmin); this service holds the business rules.
 */
export class AdminService {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly repos: {
      media: ReturnType<
        typeof import("../db/repositories/media.repository.js").createMediaRepository
      >;
      variants: ReturnType<
        typeof import("../db/repositories/variant.repository.js").createVariantRepository
      >;
      jobs: ReturnType<
        typeof import("../db/repositories/upload.repository.js").createProcessingJobRepository
      >;
    },
  ) {}

  /** Re-enqueue processing (variant regeneration / metadata refresh). */
  async reprocess(mediaId: string): Promise<ProcessingJobRow> {
    const media = await this.repos.media.findByIdNotDeleted(mediaId);
    if (!media) throw new NotFoundError();
    const job = await this.repos.jobs.insert({
      mediaId: media.id,
      jobType: "VARIANT_REGEN",
      status: "PENDING",
    });
    return job;
  }

  /** Undo a soft delete within the retention window. */
  async restore(mediaId: string): Promise<MediaRow | null> {
    const restored = await this.repos.media.restore(mediaId);
    if (restored) {
      await invalidateMedia(mediaId);
    }
    return restored;
  }

  /**
   * Permanent deletion: binaries (original + variants) first, then metadata.
   * Only sensible after the retention window; publishes media.deleted.
   */
  async purge(mediaId: string): Promise<void> {
    const media = await this.repos.media.findById(mediaId);
    if (!media) throw new NotFoundError();

    const variants = await this.repos.variants.listByMediaId(media.id);
    for (const variant of variants) {
      await this.storage.deleteObject(variant.objectKey).catch(() => undefined);
    }
    await this.storage.deleteObject(media.objectKey).catch(() => undefined);

    await this.repos.variants.deleteForMedia(media.id);
    await this.repos.media.hardDelete(media.id);

    await invalidateMedia(media.id);
    await publishMediaEvent("media.deleted", {
      mediaId: media.id,
      ownerType: media.ownerType,
      ownerId: media.ownerId,
    });
  }
}

/** env re-export kept minimal for tests that assert limits config exists. */
export const configuredMaxSize = env.MEDIA_MAX_FILE_SIZE;
