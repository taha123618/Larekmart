export {
  MediaEventPayloadSchema,
  DomainDeletedPayloadSchema,
  type MediaEventPayloadType,
  type DomainDeletedPayloadType,
} from "@repo/types";

export const MEDIA_PUBLISHED_EVENTS = [
  "media.upload_requested",
  "media.uploaded",
  "media.processing_started",
  "media.processing_completed",
  "media.processing_failed",
  "media.deleted",
  "media.quarantined",
] as const;

export type MediaPublishedEvent = (typeof MEDIA_PUBLISHED_EVENTS)[number];

export const DOMAIN_CLEANUP_TOPICS = [
  "product.deleted",
  "seller.deleted",
  "review.deleted",
  "user.deleted",
  "category.deleted",
  "brand.deleted",
] as const;

export type DomainCleanupTopic = (typeof DOMAIN_CLEANUP_TOPICS)[number];
