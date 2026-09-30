import type { MediaResponseType } from "@repo/types";
import { env } from "../config/env.js";
import {
  ForbiddenError,
  MediaNotReadyError,
  NotFoundError,
} from "../errors/errors.js";
import type { MediaRow } from "../db/repositories/media.repository.js";
import type { MediaVariantRow } from "../db/repositories/variant.repository.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import { mediaMetrics } from "../observability/metrics.js";
import {
  readMediaUrl,
  writeMediaUrl,
  readResolveBatch,
  writeResolveBatch,
  invalidateMedia,
} from "../cache/media-cache.js";

export interface MediaActor {
  userId: string;
  role: "user" | "admin";
}

/**
 * Core media domain service. Depends on the `ObjectStorage` interface —
 * never on S3/MinIO SDK types.
 */
export class MediaService {
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

  /**
   * Generates a URL for one object. URLs are created dynamically from
   * bucket + object_key — never persisted as canonical references (spec
   * section 28). Public media returns an unsigned public-style URL; private
   * media returns a presigned, expiring URL and requires authorization.
   */
  async buildMediaUrl(
    media: MediaRow,
    variantKey: string | null,
    variantObjectKey: string | null,
  ): Promise<string> {
    const objectKey = variantObjectKey ?? media.objectKey;
    if (media.visibility === "PUBLIC") {
      // Public objects stay unsigned; the endpoint is the CDN/S3 base URL.
      const base = env.S3_ENDPOINT.replace(/\/$/, "");
      return `${base}/${media.bucket}/${objectKey}`;
    }
    const download = await this.storage.createDownloadUrl({
      bucket: media.bucket,
      key: objectKey,
      expiresInSeconds: env.MEDIA_PRESIGN_EXPIRY_SECONDS,
    });
    return download.url;
  }

  /** Maps DB rows to the canonical API response shape. */
  async toMediaResponse(
    media: MediaRow,
    variants: MediaVariantRow[],
  ): Promise<MediaResponseType> {
    const variantUrls: Record<string, string> = {};
    if (media.visibility === "PUBLIC") {
      const base = env.S3_ENDPOINT.replace(/\/$/, "");
      variantUrls.original = `${base}/${media.bucket}/${media.objectKey}`;
      for (const variant of variants) {
        variantUrls[variant.variant] =
          `${base}/${media.bucket}/${variant.objectKey}`;
      }
    }

    return {
      id: media.id,
      ownerType: media.ownerType,
      ownerId: media.ownerId,
      status: media.status as MediaResponseType["status"],
      visibility: media.visibility as MediaResponseType["visibility"],
      mimeType: media.mimeType,
      originalFilename: media.originalFilename,
      sizeBytes: media.sizeBytes,
      width: media.width,
      height: media.height,
      checksum: media.checksum,
      urls: variantUrls,
      variants: variants.map((variant) => ({
        variant: variant.variant,
        mimeType: variant.mimeType,
        width: variant.width,
        height: variant.height,
        sizeBytes: variant.sizeBytes,
      })),
      createdBy: media.createdBy,
      createdAt: media.createdAt.toISOString(),
      updatedAt: media.updatedAt.toISOString(),
    };
  }

  async getMediaOrThrow(mediaId: string): Promise<MediaRow> {
    const media = await this.repos.media.findByIdNotDeleted(mediaId);
    if (!media) throw new NotFoundError();
    return media;
  }

  /** Authorization: owner or admin. Admins may manage any media. */
  assertCanManage(media: MediaRow, actor: MediaActor): void {
    if (actor.role === "admin") return;
    const isOwner =
      media.createdBy === actor.userId ||
      (media.ownerType === "user" && media.ownerId === actor.userId);
    if (!isOwner) {
      throw new ForbiddenError();
    }
  }

  /** Authorization for reads: owner, admin, or non-private visibility. */
  assertCanView(media: MediaRow, actor: MediaActor | null): void {
    if (media.visibility !== "PRIVATE") return;
    if (!actor) throw new ForbiddenError();
    if (actor.role === "admin") return;
    const isOwner =
      media.createdBy === actor.userId ||
      (media.ownerType === "user" && media.ownerId === actor.userId);
    if (!isOwner) throw new ForbiddenError();
  }

  /** GET /media/{id} — throws MediaNotReadyError for PROCESSING/PENDING reads of urls. */
  async getMedia(
    mediaId: string,
    actor: MediaActor | null,
  ): Promise<MediaResponseType> {
    const media = await this.getMediaOrThrow(mediaId);
    this.assertCanView(media, actor);
    const variants = await this.repos.variants.listByMediaId(media.id);
    return this.toMediaResponse(media, variants);
  }

  /**
   * GET /media/{id}/url — presigned/public URL for a specific variant.
   * Enforces visibility + readiness before generating anything.
   */
  async getMediaUrl(
    mediaId: string,
    variant: string | null,
    actor: MediaActor | null,
  ): Promise<{ url: string; expiresIn: number; media: MediaRow }> {
    const media = await this.getMediaOrThrow(mediaId);
    this.assertCanView(media, actor);

    if (media.status !== "READY") {
      throw new MediaNotReadyError(
        `Media is ${media.status}; URLs are only served when READY`,
      );
    }

    mediaMetrics.media_download_requests_total.inc();

    if (variant) {
      const variantRow = await this.repos.variants.findByMediaAndVariant(
        media.id,
        variant,
      );
      if (!variantRow)
        throw new NotFoundError(`Variant '${variant}' not found`);
      const url = await this.buildMediaUrl(
        media,
        variantRow.variant,
        variantRow.objectKey,
      );
      return { url, expiresIn: env.MEDIA_PRESIGN_EXPIRY_SECONDS, media };
    }

    const url = await this.buildMediaUrl(media, null, null);
    return { url, expiresIn: env.MEDIA_PRESIGN_EXPIRY_SECONDS, media };
  }

  /** Owner-scoped listing: GET /media/owner/{ownerType}/{ownerId}. */
  async listByOwner(
    ownerType: string,
    ownerId: string,
    actor: MediaActor | null,
    options: { status?: string; limit: number; offset: number },
  ): Promise<{ items: MediaResponseType[]; total: number }> {
    // Only admins may list other owners' private media; public listings of
    // PUBLIC/PROTECTED media are allowed (storefront use-case).
    if (actor?.role === "admin") {
      const result = await this.repos.media.list({
        ownerType,
        ownerId,
        status: options.status as MediaResponseType["status"] | undefined,
        limit: options.limit,
        offset: options.offset,
      });
      const items = await Promise.all(
        result.items.map(async (media) => {
          const variants = await this.repos.variants.listByMediaId(media.id);
          return this.toMediaResponse(media, variants);
        }),
      );
      return { items, total: result.total };
    }

    const result = await this.repos.media.list({
      ownerType,
      ownerId,
      status:
        (options.status as MediaResponseType["status"] | undefined) ?? "READY",
      limit: options.limit,
      offset: options.offset,
    });
    const visible = result.items.filter(
      (media) =>
        media.visibility !== "PRIVATE" || media.createdBy === actor?.userId,
    );
    const items = await Promise.all(
      visible.map(async (media) => {
        const variants = await this.repos.variants.listByMediaId(media.id);
        return this.toMediaResponse(media, variants);
      }),
    );
    return { items, total: visible.length };
  }

  /** Soft delete: metadata tombstone first; binaries purge via cleanup worker. */
  async softDelete(mediaId: string, actor: MediaActor): Promise<MediaRow> {
    const media = await this.getMediaOrThrow(mediaId);
    this.assertCanManage(media, actor);
    const deleted = await this.repos.media.softDelete(media.id);
    if (!deleted) throw new NotFoundError();
    mediaMetrics.media_deleted_total.inc();
    await invalidateMedia(media.id); // resolved URL is now null (not READY)
    return deleted;
  }

  /**
   * Batch-resolves mixed media references (storefront `images` JSON values).
   * - `media:<uuid>` / bare uuid → looked up; URL only when READY and visible
   *   to an unauthenticated caller (PUBLIC/PROTECTED); otherwise `null`.
   * - anything else (legacy Cloudinary URL, `/products/1.png`) → passed
   *   through untouched, so pre-existing products keep rendering.
   * Never throws for individual failures — unresolved entries stay `null`.
   */
  async resolveMany(
    refs: string[],
    actor: MediaActor | null,
  ): Promise<Record<string, string | null>> {
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const unique = [
      ...new Set(
        refs.filter((ref) => typeof ref === "string" && ref.length > 0),
      ),
    ];

    // 1. Batch cache probe: one Redis GET serves repeat page views wholesale.
    //    Only unauthenticated (storefront) batches are cache-eligible —
    //    actor-dependent PRIVATE visibility must not leak between callers.
    const cacheEligible = actor === null;
    if (cacheEligible) {
      const batch = await readResolveBatch(unique);
      if (batch.status === "hit" && batch.value) {
        const complete = unique.every((ref) => ref in batch.value);
        if (complete) {
          mediaMetrics.media_cache_hits_total.inc();
          return batch.value;
        }
      }
      mediaMetrics.media_cache_misses_total.inc();
    }

    const mediaIds = unique
      .map((ref) => (ref.startsWith("media:") ? ref.slice(6) : ref))
      .filter((ref) => UUID_RE.test(ref));

    // 2. Per-entry cache probe for the ids this batch must resolve.
    const cachedUrls = new Map<string, string | null>();
    const uncachedIds: string[] = [];
    if (cacheEligible) {
      await Promise.all(
        mediaIds.map(async (id) => {
          const entry = await readMediaUrl(id);
          if (entry.status === "hit") {
            cachedUrls.set(id, entry.value);
          } else {
            uncachedIds.push(id);
          }
        }),
      );
      if (cachedUrls.size > 0)
        mediaMetrics.media_cache_hits_total.inc({}, cachedUrls.size);
      if (uncachedIds.length > 0)
        mediaMetrics.media_cache_misses_total.inc({}, uncachedIds.length);
    } else {
      uncachedIds.push(...mediaIds);
    }

    // 3. Source-of-truth lookups only for ids the cache could not answer.
    const rows = new Map<string, MediaRow>();
    await Promise.all(
      uncachedIds.map(async (id) => {
        try {
          const row = await this.getMediaOrThrow(id);
          rows.set(id, row);
        } catch {
          // Unknown or deleted id → negative-cached below.
        }
      }),
    );

    // 4. Resolve, backfill the per-entry cache, assemble the response.
    const result: Record<string, string | null> = {};
    const backfill = new Map<string, string | null>();

    for (const ref of unique) {
      const id = ref.startsWith("media:") ? ref.slice(6) : ref;

      if (!UUID_RE.test(id)) {
        // Not a media reference (legacy URL / local path) → pass through.
        result[ref] = ref;
        continue;
      }

      const cached = cachedUrls.get(id);
      if (cachedUrls.has(id)) {
        result[ref] = cached ?? null;
        continue;
      }

      const row = rows.get(id);
      if (!row || row.status !== "READY") {
        result[ref] = null;
        if (cacheEligible) backfill.set(id, null); // negative entry
        continue;
      }

      try {
        this.assertCanView(row, actor);
        const variants = await this.repos.variants.listByMediaId(row.id);
        // Prefer the smallest generated variant for listings; original otherwise.
        const thumbnail = variants.find((v) => v.variant === "thumbnail");
        const url = thumbnail
          ? await this.buildMediaUrl(
              row,
              thumbnail.variant,
              thumbnail.objectKey,
            )
          : await this.buildMediaUrl(row, null, null);
        result[ref] = url;
        if (cacheEligible) backfill.set(id, url);
      } catch {
        result[ref] = null;
        if (cacheEligible) backfill.set(id, null);
      }
    }

    if (cacheEligible) {
      // Backfill per-entry entries, then store the batch for wholesale replay.
      await Promise.all(
        [...backfill].map(([id, url]) => writeMediaUrl(id, url)),
      );
      await writeResolveBatch(unique, result);
    }
    return result;
  }
}
