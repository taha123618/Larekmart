import { createHash } from "node:crypto";
import type { MediaRow } from "../db/repositories/media.repository.js";
import type { ProcessingJobRow } from "../db/repositories/upload.repository.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import { buildVariantObjectKey } from "../storage/object-keys.js";
import {
  generateVariants,
  extractImageMetadata,
  isProcessableImage,
} from "../processing/image.processor.js";
import { env } from "../config/env.js";
import { categoryFor } from "../schemas/upload.schema.js";
import { mediaMetrics } from "../observability/metrics.js";
import { logger } from "../observability/metrics.js";

/**
 * Processing service — the Sharp pipeline executed by media-worker.
 * Idempotent: variant upserts overwrite the same object keys, so re-running
 * a job for the same media produces the same result.
 */
export class ProcessingService {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly repos: {
      media: ReturnType<
        typeof import("../db/repositories/media.repository.js").createMediaRepository
      >;
      variants: ReturnType<
        typeof import("../db/repositories/variant.repository.js").createVariantRepository
      >;
    },
  ) {}

  /** Executes one IMAGE_PROCESS job end-to-end. */
  async processMedia(mediaId: string): Promise<MediaRow> {
    const media = await this.repos.media.findById(mediaId);
    if (!media) throw new Error(`Media ${mediaId} not found for processing`);

    // Original object must exist (upload verification already passed).
    const original = await this.storage.getObjectBuffer(
      media.bucket,
      media.objectKey,
    );

    // Magic-byte verification — client Content-Type is never proof of type.
    const detected = isProcessableImage(original);
    if (!detected) {
      throw new Error(
        `Object content is not a processable image (declared ${media.mimeType})`,
      );
    }

    // Checksum for dedup/corruption detection (spec section 31).
    const checksum = createHash("sha256").update(original).digest("hex");

    if (detected) {
      // Extract dimensions via Sharp metadata.
      const imageMeta = await extractImageMetadata(original);
      await this.repos.media.updateProcessed(media.id, {
        checksum,
        width: imageMeta.width,
        height: imageMeta.height,
        sizeBytes: original.length,
      });

      // Variant set follows the upload category: avatars get avatar/thumbnail
      // (square 256px), review images thumbnail/medium, product images the
      // full responsive ladder. Config-driven — never hard-coded per domain.
      const category = categoryFor(media.mimeType);
      const variantConfigs =
        env.categoryVariants[category] ?? env.variants;
      const results = await generateVariants(original, {
        variantConfigs,
      });

      for (const result of results) {
        const variantKey = buildVariantObjectKey({
          ownerType: media.ownerType,
          ownerId: media.ownerId,
          mediaId: media.id,
          variant: result.variant,
          mimeType: result.mimeType,
        });
        await this.storage.putObject(
          media.bucket,
          variantKey,
          result.buffer,
          result.mimeType,
        );
        await this.repos.variants.upsert({
          mediaId: media.id,
          variant: result.variant,
          bucket: media.bucket,
          objectKey: variantKey,
          mimeType: result.mimeType,
          width: result.width,
          height: result.height,
          sizeBytes: result.buffer.length,
        });
      }
    }

    const updated = await this.repos.media.findById(mediaId);
    if (!updated)
      throw new Error(`Media ${mediaId} disappeared during processing`);
    return updated;
  }

  /** Executes a claimed job with retry/idempotency semantics. */
  async runJob(
    job: ProcessingJobRow,
    handlers: {
      onReady: (mediaId: string) => Promise<unknown>;
      onFailed: (mediaId: string, error: string) => Promise<unknown>;
      onQuarantine: (mediaId: string, reason: string) => Promise<unknown>;
    },
  ): Promise<"COMPLETED" | "RETRY" | "FAILED"> {
    const startedAt = Date.now();
    try {
      await this.processMedia(job.mediaId);
      const durationSeconds = (Date.now() - startedAt) / 1000;
      mediaMetrics.media_processing_duration_seconds.observe(
        { jobType: job.jobType },
        durationSeconds,
      );
      mediaMetrics.media_processing_total.inc();
      await handlers.onReady(job.mediaId);
      return "COMPLETED";
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown processing error";
      logger.error(`Processing job ${job.id} failed`, error);

      // Content that is not the declared image type is quarantined, not
      // retried — it will never succeed.
      const isContentMismatch = message.includes("processable image");
      if (isContentMismatch) {
        await handlers.onQuarantine(job.mediaId, message);
        return "FAILED";
      }

      await handlers.onFailed(job.mediaId, message);
      return "RETRY";
    }
  }
}
