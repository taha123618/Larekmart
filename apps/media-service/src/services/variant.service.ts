import type { ObjectStorage } from "../storage/object-storage.js";
import type { createMediaRepository } from "../db/repositories/media.repository.js";
import type {
  createVariantRepository,
  MediaVariantRow,
} from "../db/repositories/variant.repository.js";
import { buildVariantObjectKey } from "../storage/object-keys.js";
import {
  generateVariants,
  type VariantConfig,
} from "../processing/image.processor.js";
import { env } from "../config/env.js";
import { categoryFor, type MediaCategory } from "../schemas/upload.schema.js";
import { invalidateMedia } from "../cache/media-cache.js";
import { NotFoundError, ValidationError } from "../errors/errors.js";

export class VariantService {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly repos: {
      media: ReturnType<typeof createMediaRepository>;
      variants: ReturnType<typeof createVariantRepository>;
    },
  ) {}

  /** Lists existing variants for a media. */
  async listVariants(mediaId: string): Promise<MediaVariantRow[]> {
    return this.repos.variants.listByMediaId(mediaId);
  }

  /**
   * Generates or regenerates variants for a media asset.
   * Can accept custom/filtered variants or generate all default variants for its category.
   */
  async generateVariantsForMedia(
    mediaId: string,
    options?: {
      variantNames?: string[];
      force?: boolean;
    },
  ): Promise<MediaVariantRow[]> {
    const media = await this.repos.media.findByIdNotDeleted(mediaId);
    if (!media) {
      throw new NotFoundError(`Media ${mediaId} not found`);
    }

    if (media.status !== "READY" && !options?.force) {
      throw new ValidationError(
        `Media status is ${media.status}; variants can only be generated for READY media unless forced`,
      );
    }

    const original = await this.storage.getObjectBuffer(
      media.bucket,
      media.objectKey,
    );

    const category =
      (media.category as MediaCategory) || categoryFor(media.mimeType);
    let variantConfigs: readonly VariantConfig[] =
      env.categoryVariants[category] ?? env.variants;

    if (options?.variantNames && options.variantNames.length > 0) {
      variantConfigs = variantConfigs.filter((c) =>
        options.variantNames!.includes(c.name),
      );
      if (variantConfigs.length === 0) {
        throw new ValidationError("No matching variant configurations found");
      }
    }

    const results = await generateVariants(original, { variantConfigs });
    const savedVariants: MediaVariantRow[] = [];

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

      const saved = await this.repos.variants.upsert({
        mediaId: media.id,
        variant: result.variant,
        bucket: media.bucket,
        objectKey: variantKey,
        mimeType: result.mimeType,
        width: result.width,
        height: result.height,
        sizeBytes: result.buffer.length,
      });

      savedVariants.push(saved);
    }

    await invalidateMedia(media.id);
    return savedVariants;
  }

  /** Deletes all variants for a media from storage and database. */
  async deleteVariantsForMedia(mediaId: string): Promise<void> {
    const variants = await this.repos.variants.listByMediaId(mediaId);
    for (const variant of variants) {
      await this.storage.deleteObject(variant.objectKey).catch(() => undefined);
    }
    await this.repos.variants.deleteForMedia(mediaId);
    await invalidateMedia(mediaId);
  }
}
