import { MediaOwnerTypeEnum, MediaVisibilityEnum } from "@repo/types";
import { z } from "zod";
import { env } from "../config/env.js";

/**
 * Centralized upload validation. All limits are configuration-driven —
 * different categories have different caps (spec section 29) and nothing is
 * hard-coded at call sites.
 */

/**
 * Images accepted for Sharp variant generation. `application/octet-stream`
 * is intentionally NOT accepted: client Content-Type is untrusted, so the
 * actual type is verified by magic bytes at completion time.
 */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
] as const;

export const SUPPORTED_DOCUMENT_MIME_TYPES = ["application/pdf"] as const;

export const SUPPORTED_MIME_TYPES: readonly string[] = [
  ...SUPPORTED_IMAGE_MIME_TYPES,
  ...SUPPORTED_DOCUMENT_MIME_TYPES,
];

/** Maps MIME type to allowed extensions. */
export const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "image/gif": ["gif"],
  "image/tiff": ["tiff", "tif"],
  "application/pdf": ["pdf"],
};

/**
 * Client-declared category (drives size limits). Falls back to a type-based
 * inference when omitted.
 */
export const MediaCategorySchema = z.enum([
  "avatar",
  "product-image",
  "review-image",
  "seller-document",
  "marketing-image",
  "video",
]);

export type MediaCategory = z.infer<typeof MediaCategorySchema>;

/** Maps a category to the visibility default used when the client omits it. */
export const CATEGORY_DEFAULT_VISIBILITY: Record<MediaCategory, string> = {
  avatar: "PUBLIC",
  "product-image": "PUBLIC",
  "review-image": "PROTECTED",
  "seller-document": "PRIVATE",
  "marketing-image": "PUBLIC",
  video: "PUBLIC",
};

/** Maps a category to its owner default (avatars belong to users, etc.). */
export const CATEGORY_OWNER_HINT: Partial<Record<MediaCategory, string>> = {
  avatar: "user",
};

const MAX_FILENAME_LENGTH = 255;

export const UploadRequestSchema = z.object({
  ownerType: z
    .string()
    .refine((value) => (env.ownerTypes as string[]).includes(value), {
      message: `ownerType must be one of: ${(env.ownerTypes as string[]).join(", ")}`,
    }),
  ownerId: z
    .string()
    .min(1)
    .max(200)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/,
      "ownerId contains unsupported characters",
    ),
  filename: z.string().min(1).max(MAX_FILENAME_LENGTH),
  contentType: z.string().min(3).max(100),
  size: z.number().int().positive(),
  category: MediaCategorySchema.optional(),
  visibility: MediaVisibilityEnum.optional(),
});

export type UploadRequestInput = z.infer<typeof UploadRequestSchema>;

/** Size limit for a category, falling back to the global maximum. */
export function limitForCategory(category: MediaCategory): number {
  return env.uploadLimits[category] ?? env.MEDIA_MAX_FILE_SIZE;
}

/** Magic-byte signatures for actual-type verification (spec section 23). */
export const MAGIC_BYTES: Array<{
  mimeType: string;
  offset: number;
  bytes: number[];
}> = [
  { mimeType: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mimeType: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mimeType: "image/gif", offset: 0, bytes: [0x47, 0x49, 0x46] },
  {
    mimeType: "image/webp",
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46], // "RIFF" + WEBP at offset 8
  },
  {
    mimeType: "image/avif",
    offset: 4,
    bytes: [0x66, 0x74, 0x79, 0x70], // "ftyp" box
  },
  { mimeType: "image/tiff", offset: 0, bytes: [0x49, 0x49, 0x2a, 0x00] },
  { mimeType: "image/tiff", offset: 0, bytes: [0x4d, 0x4d, 0x00, 0x2a] },
  { mimeType: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
];

/**
 * Verifies actual file content by magic bytes. Returns the detected MIME
 * type, or null when no signature matches.
 */
export function detectMimeType(buffer: Buffer): string | null {
  for (const signature of MAGIC_BYTES) {
    const match = signature.bytes.every(
      (byte, index) => buffer[signature.offset + index] === byte,
    );
    if (match) {
      // WEBP requires the second check; AVIF/other ISOBMFF need the brand.
      if (signature.mimeType === "image/webp") {
        const brand = buffer.subarray(8, 12).toString("ascii");
        return brand === "WEBP" ? signature.mimeType : null;
      }
      if (signature.mimeType === "image/avif") {
        const brand = buffer.subarray(8, 12).toString("ascii");
        return brand.startsWith("avi") || brand.startsWith("AVIS")
          ? signature.mimeType
          : null;
      }
      return signature.mimeType;
    }
  }
  return null;
}

/** Validates that extension matches the declared/detected MIME type. */
export function extensionMatchesMime(
  extension: string,
  mimeType: string,
): boolean {
  const allowed = MIME_EXTENSIONS[mimeType];
  return allowed?.includes(extension.toLowerCase()) ?? false;
}

/**
 * Infers the upload category from a MIME type. This is the *default* — when
 * the client declares a category explicitly (e.g. `avatar`, `review-image`),
 * that declaration wins because it flows through `UploadRequestSchema` and
 * is persisted on the media row.
 */
export function categoryFor(contentType: string): MediaCategory {
  if (contentType === "application/pdf") return "seller-document";
  if (contentType.startsWith("image/")) return "product-image";
  return "product-image";
}
