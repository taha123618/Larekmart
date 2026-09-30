import { z } from "zod";

// ==========================================
// Media Enums
// ==========================================

/**
 * Media lifecycle statuses owned by media-service.
 *
 * Normal flow:  PENDING → UPLOADING → PROCESSING → READY
 * Failure:      PROCESSING → FAILED
 * Security:     any state → QUARANTINED (validation/scan failure)
 * Deletion:     any state → DELETED (soft) → purge removes binaries + rows
 */
export const MediaStatusEnum = z.enum([
  "PENDING",
  "UPLOADING",
  "PROCESSING",
  "READY",
  "FAILED",
  "QUARANTINED",
  "DELETED",
]);
export type MediaStatusType = z.infer<typeof MediaStatusEnum>;

export const MediaVisibilityEnum = z.enum(["PUBLIC", "PRIVATE", "PROTECTED"]);
export type MediaVisibilityType = z.infer<typeof MediaVisibilityEnum>;

/**
 * Generic ownership references. media-service never owns these entities —
 * it stores `(ownerType, ownerId)` pairs without cross-database foreign keys.
 * The default set is configurable per deployment via MEDIA_OWNER_TYPES.
 */
export const MediaOwnerTypeEnum = z.enum([
  "product",
  "seller",
  "user",
  "review",
  "category",
  "brand",
  "collection",
  "marketing",
]);
export type MediaOwnerTypeType = z.infer<typeof MediaOwnerTypeEnum>;

export const MediaVariantEnum = z.enum([
  "original",
  "thumbnail",
  "small",
  "medium",
  "large",
  "logo",
  "avatar",
]);
export type MediaVariantType = z.infer<typeof MediaVariantEnum>;

export const MediaProcessingJobTypeEnum = z.enum([
  "IMAGE_PROCESS",
  "VARIANT_REGEN",
  "METADATA_EXTRACT",
]);
export type MediaProcessingJobTypeType = z.infer<
  typeof MediaProcessingJobTypeEnum
>;

export const MediaProcessingJobStatusEnum = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);
export type MediaProcessingJobStatusType = z.infer<
  typeof MediaProcessingJobStatusEnum
>;

export const MediaUploadSessionStatusEnum = z.enum([
  "PENDING",
  "COMPLETED",
  "EXPIRED",
  "ABORTED",
]);
export type MediaUploadSessionStatusType = z.infer<
  typeof MediaUploadSessionStatusEnum
>;

// ==========================================
// Upload API Schemas
// ==========================================

/**
 * POST /api/v1/media/uploads — request body.
 * Client-provided metadata is never trusted: MIME type, extension and size
 * are re-verified against the stored object at completion time.
 */
export const MediaUploadRequestSchema = z.object({
  ownerType: MediaOwnerTypeEnum,
  ownerId: z
    .string()
    .min(1)
    .max(200)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/,
      "ownerId contains unsupported characters",
    ),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(3).max(100),
  size: z.number().int().positive(),
  /** Optional upload category override (avatar, product-image, video, ...). */
  category: z.string().max(50).optional(),
  visibility: MediaVisibilityEnum.optional(),
});
export type MediaUploadRequestType = z.infer<typeof MediaUploadRequestSchema>;

// ==========================================
// Media API Schemas
// ==========================================

export const MediaVariantResponseSchema = z.object({
  variant: z.string(),
  mimeType: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  sizeBytes: z.number(),
});
export type MediaVariantResponseType = z.infer<
  typeof MediaVariantResponseSchema
>;

/**
 * Canonical media API response. URLs are generated dynamically from
 * bucket + object_key — never stored as canonical references.
 */
export const MediaResponseSchema = z.object({
  id: z.string(),
  ownerType: z.string(),
  ownerId: z.string(),
  status: MediaStatusEnum,
  visibility: MediaVisibilityEnum,
  mimeType: z.string(),
  originalFilename: z.string(),
  sizeBytes: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  checksum: z.string().nullable(),
  urls: z.record(z.string(), z.string()),
  variants: z.array(MediaVariantResponseSchema).optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MediaResponseType = z.infer<typeof MediaResponseSchema>;

/** POST /api/v1/media/uploads — response body. */
export const MediaUploadUrlResponseSchema = z.object({
  mediaId: z.string().min(1),
  uploadUrl: z.string().url(),
  objectKey: z.string().min(1),
  bucket: z.string().min(1),
  expiresAt: z.string(),
  media: MediaResponseSchema,
});
export type MediaUploadUrlResponseType = z.infer<
  typeof MediaUploadUrlResponseSchema
>;

export const MediaIdParamsSchema = z.object({
  mediaId: z.string().min(1).max(100),
});

export const MediaOwnerParamsSchema = z.object({
  ownerType: MediaOwnerTypeEnum,
  ownerId: z.string().min(1).max(200),
});

export const MediaListQuerySchema = z.object({
  status: MediaStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(500).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/** GET /api/v1/media/{mediaId}/url — optional variant selector. */
export const MediaUrlQuerySchema = z.object({
  variant: MediaVariantEnum.optional(),
});

/**
 * POST /api/v1/media/resolve — batch mediaId → URL resolution.
 * Values are the raw references stored by consuming services (e.g. the
 * product `images` JSON): `media:<uuid>`, a bare uuid, or a legacy URL that
 * is passed through untouched.
 */
export const MediaResolveRequestSchema = z.object({
  ids: z.array(z.string().min(1).max(512)).max(200),
});
export type MediaResolveRequestType = z.infer<typeof MediaResolveRequestSchema>;

export const MediaResolveResponseSchema = z.object({
  items: z.record(z.string(), z.string().nullable()),
});
export type MediaResolveResponseType = z.infer<
  typeof MediaResolveResponseSchema
>;

// ==========================================
// Kafka Event Schemas
// ==========================================

/**
 * Canonical `media.*` event payload. Published with the repository envelope:
 * `producer.send(topic, { value: payload })`.
 */
export const MediaEventPayloadSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  mediaId: z.string().min(1),
  ownerType: z.string().optional(),
  ownerId: z.string().optional(),
  bucket: z.string().optional(),
  objectKey: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  checksum: z.string().optional(),
  error: z.string().optional(),
  occurredAt: z.string(),
});
export type MediaEventPayloadType = z.infer<typeof MediaEventPayloadSchema>;

/**
 * Payload shape consumed from domain-deletion events. Producers in this
 * monorepo differ (product.deleted sends a bare id, user.deleted sends a
 * rich payload), so this schema defensively extracts an owner id from any
 * of the known shapes.
 */
export const DomainDeletedPayloadSchema = z.union([
  z.number().int().positive(),
  z.string().min(1),
  z.object({
    id: z.union([z.number(), z.string()]).optional(),
    productId: z.union([z.number(), z.string()]).optional(),
    sellerId: z.union([z.number(), z.string()]).optional(),
    reviewId: z.union([z.number(), z.string()]).optional(),
    categoryId: z.union([z.number(), z.string()]).optional(),
    brandId: z.union([z.number(), z.string()]).optional(),
    userId: z.string().optional(),
    eventId: z.string().optional(),
    eventType: z.string().optional(),
  }),
]);
export type DomainDeletedPayloadType = z.infer<
  typeof DomainDeletedPayloadSchema
>;

// ==========================================
// Media Reference Utilities & Topic Contracts
// ==========================================

export const MediaTopicEnum = z.enum([
  "media.upload_requested",
  "media.uploaded",
  "media.processing_started",
  "media.processing_completed",
  "media.processing_failed",
  "media.deleted",
  "media.quarantined",
]);
export type MediaTopic = z.infer<typeof MediaTopicEnum>;

/**
 * Media reference shape shared by all domains: `media:<uuid>` (or a bare
 * uuid from legacy rows). Anything else is a passthrough URL.
 */
export const MediaRefSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^(media:)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Must be a media reference (media:<uuid> or bare uuid)",
  );
export type MediaRefType = z.infer<typeof MediaRefSchema>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tests whether a string is a media reference (`media:<uuid>` or a bare UUID). */
export function isMediaRef(val: unknown): val is string {
  if (typeof val !== "string" || !val) return false;
  const stripped = val.startsWith("media:") ? val.slice(6) : val;
  return UUID_REGEX.test(stripped);
}

/** Extracts the raw media UUID from a reference string, or null if not a media ref. */
export function extractMediaId(val: unknown): string | null {
  if (typeof val !== "string" || !val) return null;
  const stripped = val.startsWith("media:") ? val.slice(6) : val;
  return UUID_REGEX.test(stripped) ? stripped : null;
}

/** Formats a media UUID as a canonical `media:<uuid>` reference. */
export function buildMediaRef(mediaId: string): string {
  const stripped = mediaId.startsWith("media:") ? mediaId.slice(6) : mediaId;
  return `media:${stripped}`;
}

/** Extracts all unique media IDs from an arbitrary object, map, array, or string. */
export function parseMediaReferences(input: unknown): string[] {
  if (!input) return [];
  const found = new Set<string>();

  const scan = (item: unknown) => {
    if (typeof item === "string") {
      const id = extractMediaId(item);
      if (id) found.add(id);
    } else if (Array.isArray(item)) {
      for (const el of item) scan(el);
    } else if (typeof item === "object" && item !== null) {
      for (const val of Object.values(item as Record<string, unknown>)) {
        scan(val);
      }
    }
  };

  scan(input);
  return Array.from(found);
}
