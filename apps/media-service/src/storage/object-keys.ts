import { randomUUID } from "node:crypto";
import { ObjectKeySchema } from "../processing/validation.js";

/**
 * Object-key strategy (spec section 13).
 *
 * Format: `{ownerPlural}/{ownerId}/{mediaId}/{variant}.{ext}`
 * Examples:
 *   products/product_123/media_123/original.jpg
 *   products/product_123/media_123/thumbnail.webp
 *   sellers/seller_9/media_100/logo.webp
 *   users/user_5/media_77/avatar.webp
 *
 * The user-provided filename is NEVER used as an object key — only its
 * sanitized form is stored as `original_filename` metadata.
 */

const OWNER_KEY_SEGMENTS: Record<string, string> = {
  product: "products",
  seller: "sellers",
  user: "users",
  review: "reviews",
  category: "categories",
  brand: "brands",
  collection: "collections",
  marketing: "marketing",
};

/** Safely reduces an owner id to a single URI-safe path segment. */
function ownerSegment(ownerId: string): string {
  const segment = ownerId
    .replace(/[^A-Za-z0-9_.-]/g, "-")
    // Neutralize traversal sequences: `..` (and runs of dots) become a single dot.
    .replace(/\.{2,}/g, ".")
    .slice(0, 128);
  return segment.length > 0 ? segment : "unknown";
}

export function variantExtension(mimeType: string): string {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/avif") return "avif";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return mimeType.split("/")[1] ?? "bin";
}

/** Builds the original object key for a new media record. */
export function buildOriginalObjectKey(input: {
  ownerType: string;
  ownerId: string;
  mediaId: string;
  extension: string;
}): string {
  const segment =
    OWNER_KEY_SEGMENTS[input.ownerType] ?? input.ownerType.toLowerCase();
  const key = `${segment}/${ownerSegment(input.ownerId)}/${input.mediaId}/original.${input.extension}`;
  // Keys are service-generated, but validate anyway (defense in depth).
  return ObjectKeySchema.parse(key);
}

/** Builds the object key for a derived variant. */
export function buildVariantObjectKey(input: {
  ownerType: string;
  ownerId: string;
  mediaId: string;
  variant: string;
  mimeType: string;
}): string {
  const segment =
    OWNER_KEY_SEGMENTS[input.ownerType] ?? input.ownerType.toLowerCase();
  const key = `${segment}/${ownerSegment(input.ownerId)}/${input.mediaId}/${input.variant}.${variantExtension(input.mimeType)}`;
  return ObjectKeySchema.parse(key);
}

/** Extracts the file extension from a filename; defaults to `bin`. */
export function extensionFromFilename(filename: string): string {
  const parts = filename.split(".");
  const ext = (parts[parts.length - 1] ?? "").toLowerCase();
  const stem = parts.slice(0, -1).join(".");
  if (
    !ext ||
    stem.length === 0 || // dotfile like ".hidden" or ".env" — no real extension
    !/^[a-z0-9]{1,10}$/.test(ext)
  ) {
    return "bin";
  }
  return ext;
}

/** Generates a new media id with the `media_` prefix used in API payloads. */
export function newMediaId(): string {
  return `media_${randomUUID()}`;
}
