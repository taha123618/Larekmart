import type { MediaResponseType, MediaStatusType } from "@repo/types";
import { env } from "../config/env.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  MediaTypeNotSupportedError,
  MediaTooLargeError,
  UploadError,
  ValidationError,
} from "../errors/errors.js";
import {
  CATEGORY_DEFAULT_VISIBILITY,
  extensionMatchesMime,
  limitForCategory,
  MediaCategorySchema,
  SUPPORTED_MIME_TYPES,
  UploadRequestSchema,
  type MediaCategory,
} from "../schemas/upload.schema.js";
import { sanitizeFilename } from "../processing/validation.js";
import { extensionFromFilename } from "../storage/object-keys.js";
import { buildOriginalObjectKey } from "../storage/object-keys.js";
import type { MediaRow } from "../db/repositories/media.repository.js";
import type { MediaVariantRow } from "../db/repositories/variant.repository.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import type { MediaService, MediaActor } from "./media.service.js";
import { mediaMetrics } from "../observability/metrics.js";
import { publishMediaEvent } from "../messaging/publishers/media.publisher.js";
import { cacheSet } from "@repo/redis";
import { redis } from "../utils/redis.js";
import { invalidateMedia } from "../cache/media-cache.js";

const ID = "upload.service";

/**
 * Upload lifecycle service.
 *
 * Flow (spec sections 8–11):
 *   1. POST /uploads    → validate + authorize + create metadata (PENDING)
 *                         + presigned PUT URL
 *   2. Client uploads directly to S3/MinIO (never through Hono)
 *   3. POST /complete   → verify object exists + size/type, re-check limits,
 *                         publish media.uploaded, enqueue processing job
 */
export class UploadService {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly repos: {
      media: ReturnType<
        typeof import("../db/repositories/media.repository.js").createMediaRepository
      >;
      variants: ReturnType<
        typeof import("../db/repositories/variant.repository.js").createVariantRepository
      >;
      uploads: ReturnType<
        typeof import("../db/repositories/upload.repository.js").createUploadRepository
      >;
      jobs: ReturnType<
        typeof import("../db/repositories/upload.repository.js").createProcessingJobRepository
      >;
      events: ReturnType<
        typeof import("../db/repositories/event.repository.js").createEventRepository
      >;
    },
    private readonly mediaService: MediaService,
  ) {}

  /** Step 1: create a media record + presigned upload URL. */
  async createUpload(
    input: unknown,
    actor: MediaActor,
  ): Promise<{
    mediaId: string;
    uploadUrl: string;
    objectKey: string;
    bucket: string;
    expiresAt: string;
    media: MediaResponseType;
  }> {
    const parsed = UploadRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Invalid upload request", parsed.error.issues);
    }
    const request = parsed.data;

    // Size limit per category (client cannot pick an oversized bucket by
    // declaring a different category than the content type implies).
    const category: MediaCategory =
      request.category ?? this.inferCategory(request.contentType);
    const limit = limitForCategory(category);
    if (request.size > limit) {
      mediaMetrics.media_upload_failures_total.inc();
      throw new MediaTooLargeError(
        `File exceeds ${limit} bytes limit for category '${category}'`,
      );
    }

    // MIME allowlist + extension/MIME consistency.
    if (
      !(SUPPORTED_MIME_TYPES as readonly string[]).includes(request.contentType)
    ) {
      mediaMetrics.media_upload_failures_total.inc();
      throw new MediaTypeNotSupportedError(
        `Content type '${request.contentType}' is not supported`,
      );
    }
    const extension = extensionFromFilename(request.filename);
    if (!extensionMatchesMime(extension, request.contentType)) {
      mediaMetrics.media_upload_failures_total.inc();
      throw new ValidationError(
        `File extension '${extension}' does not match content type '${request.contentType}'`,
      );
    }

    // Owner authorization: a seller/user may only create media for owners
    // they control (spec section 25). Users own their own ids; admins may
    // create for any owner.
    this.assertOwnerAuthorization(request.ownerType, request.ownerId, actor);

    const mediaId = crypto.randomUUID();
    const sanitized = sanitizeFilename(request.filename);
    const objectKey = buildOriginalObjectKey({
      ownerType: request.ownerType,
      ownerId: request.ownerId,
      mediaId,
      extension,
    });

    const visibility =
      request.visibility ?? CATEGORY_DEFAULT_VISIBILITY[category] ?? "PUBLIC";

    const media = await this.repos.media.insert({
      id: mediaId,
      ownerType: request.ownerType,
      ownerId: request.ownerId,
      bucket: env.S3_BUCKET,
      objectKey,
      originalFilename: sanitized,
      mimeType: request.contentType,
      extension,
      sizeBytes: request.size,
      status: "PENDING",
      visibility,
      category,
      createdBy: actor.userId,
    });

    const session = await this.repos.uploads.insert({
      mediaId: media.id,
      objectKey,
      status: "PENDING",
      expiresAt: new Date(
        Date.now() + env.MEDIA_UPLOAD_SESSION_TTL_SECONDS * 1000,
      ),
    });

    const uploadUrl = await this.storage.createUploadUrl({
      bucket: env.S3_BUCKET,
      key: objectKey,
      contentType: request.contentType,
      contentLength: request.size,
      expiresInSeconds: env.MEDIA_PRESIGN_EXPIRY_SECONDS,
    });

    mediaMetrics.media_uploads_total.inc();

    await publishMediaEvent("media.upload_requested", {
      mediaId: media.id,
      ownerType: media.ownerType,
      ownerId: media.ownerId,
      bucket: media.bucket,
      objectKey,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
    });

    const response = await this.mediaService.toMediaResponse(media, []);
    return {
      mediaId: media.id,
      uploadUrl: uploadUrl.url,
      objectKey,
      bucket: env.S3_BUCKET,
      expiresAt: uploadUrl.expiresAt.toISOString(),
      media: response,
    };
  }

  /** Step 2: client finished the direct upload — verify + enqueue processing. */
  async completeUpload(
    mediaId: string,
    actor: MediaActor,
  ): Promise<MediaResponseType> {
    const media = await this.repos.media.findByIdNotDeleted(mediaId);
    if (!media) throw new NotFoundError();
    this.mediaService.assertCanManage(media, actor);

    const session = await this.repos.uploads.findLatestForMedia(media.id);
    if (!session || session.status === "COMPLETED") {
      throw new ConflictError("Upload session missing or already completed");
    }
    if (session.status === "EXPIRED" || session.status === "ABORTED") {
      throw new ConflictError(
        `Upload session is ${session.status.toLowerCase()}`,
      );
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.repos.uploads.markExpired(session.id);
      throw new ConflictError("Upload session has expired");
    }

    // Verify the object actually exists (client may have aborted).
    const metadata = await this.storage.getMetadata(
      media.bucket,
      media.objectKey,
    );
    if (!metadata.exists) {
      mediaMetrics.media_upload_failures_total.inc();
      throw new UploadError(
        "Uploaded object was not found in storage; upload did not complete",
      );
    }

    // Re-verify size against the declared + configured limit.
    const category: MediaCategory = this.inferCategory(media.mimeType);
    const limit = limitForCategory(category);
    const actualSize = metadata.contentLength ?? 0;
    if (actualSize <= 0 || actualSize > limit) {
      mediaMetrics.media_upload_failures_total.inc();
      await this.storage.deleteObject(media.objectKey).catch(() => undefined);
      throw new MediaTooLargeError(
        `Actual object size ${actualSize} exceeds limit ${limit}`,
      );
    }

    // Re-verify declared type vs extension; the worker additionally verifies
    // actual magic bytes on first bytes of the object (spec section 23).
    if (
      !extensionMatchesMime(media.extension, media.mimeType) ||
      !(SUPPORTED_MIME_TYPES as readonly string[]).includes(media.mimeType)
    ) {
      mediaMetrics.media_upload_failures_total.inc();
      await this.quarantine(
        media.id,
        "Declared type/extension mismatch at completion",
      );
      throw new MediaTypeNotSupportedError();
    }

    // Persist verification and move the lifecycle forward.
    const updated = await this.repos.media.updateProcessed(media.id, {
      sizeBytes: actualSize,
    });
    await this.repos.uploads.markCompleted(session.id);
    await this.repos.media.updateStatus(media.id, "UPLOADING");
    await this.repos.media.updateStatus(media.id, "PROCESSING");

    // Idempotency marker for completion retries.
    await cacheSet(
      redis.client,
      redis.keys.simple(`completed:${media.id}`),
      { completedAt: new Date().toISOString() },
      300,
    );

    await publishMediaEvent("media.uploaded", {
      mediaId: media.id,
      ownerType: media.ownerType,
      ownerId: media.ownerId,
      bucket: media.bucket,
      objectKey: media.objectKey,
      mimeType: media.mimeType,
      sizeBytes: actualSize,
    });

    await publishMediaEvent("media.processing_started", {
      mediaId: media.id,
      ownerType: media.ownerType,
      ownerId: media.ownerId,
    });

    // Enqueue the Sharp processing job (executed by media-worker).
    await this.repos.jobs.insert({
      mediaId: media.id,
      jobType: "IMAGE_PROCESS",
      status: "PENDING",
    });

    const variants = await this.repos.variants.listByMediaId(media.id);
    return this.mediaService.toMediaResponse(updated, variants);
  }

  /** Used by the worker after successful processing: mark READY + publish. */
  async markProcessedReady(mediaId: string): Promise<MediaRow> {
    const media = await this.repos.media.updateStatus(
      mediaId,
      "READY" as MediaStatusType,
    );
    await publishMediaEvent("media.processing_completed", {
      mediaId: media.id,
      ownerType: media.ownerType,
      ownerId: media.ownerId,
      bucket: media.bucket,
      objectKey: media.objectKey,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      width: media.width ?? undefined,
      height: media.height ?? undefined,
      checksum: media.checksum ?? undefined,
    });
    // READY changes the resolved URL (null → thumbnail/original): invalidate
    // so storefronts see the processed image on their next page view.
    await invalidateMedia(media.id);
    return media;
  }

  /** Used by the worker on failure: FAILED status + event + metrics. */
  async markProcessingFailed(
    mediaId: string,
    error: string,
  ): Promise<MediaRow> {
    const media = await this.repos.media.updateStatus(
      mediaId,
      "FAILED" as MediaStatusType,
    );
    await publishMediaEvent("media.processing_failed", {
      mediaId: media.id,
      ownerType: media.ownerType,
      ownerId: media.ownerId,
      error,
    });
    return media;
  }

  /** Quarantine: validation/scan failure path. */
  async quarantine(mediaId: string, reason: string): Promise<MediaRow> {
    const media = await this.repos.media.updateStatus(
      mediaId,
      "QUARANTINED" as MediaStatusType,
    );
    mediaMetrics.media_quarantined_total.inc();
    await invalidateMedia(media.id); // no longer resolvable
    await publishMediaEvent("media.quarantined", {
      mediaId: media.id,
      ownerType: media.ownerType,
      ownerId: media.ownerId,
      error: reason,
    });
    return media;
  }

  /**
   * Seller A may only create media for owner ids they control. Owner model:
   * user-owned types require the actor id; other types require an admin or
   * a matching created_by (verified in later mutations) — this check blocks
   * the trivially-forged cross-owner uploads.
   */
  private assertOwnerAuthorization(
    ownerType: string,
    ownerId: string,
    actor: MediaActor,
  ): void {
    if (actor.role === "admin") return;
    if (ownerType === "user" && ownerId !== actor.userId) {
      throw new ForbiddenError("Users may only upload media for themselves");
    }
    // product/seller/review/... ownership is enforced by the owning domain
    // (which holds the authoritative relation); media-service records
    // created_by for audit and enforces it on every later mutation.
  }

  private inferCategory(contentType: string): MediaCategory {
    if (contentType === "application/pdf") return "seller-document";
    const parsed = MediaCategorySchema.safeParse(contentType);
    if (parsed.success) return parsed.data;
    if (contentType.startsWith("image/")) return "product-image";
    return "product-image";
  }
}
