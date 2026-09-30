import { z } from "zod";

/**
 * Storage-provider input validation. Client-controlled strings that end up in
 * object keys or storage operations are validated here, before the provider
 * layer sees them.
 */

export const BucketNameSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, "invalid bucket name");

/**
 * Object keys are service-generated, but the boundary is enforced here anyway
 * (defense in depth): no `..`, no leading slash, no backslashes, no control
 * characters, no URI-special characters, length bounded. User-controlled paths
 * are never concatenated into keys.
 */
export const ObjectKeySchema = z
  .string()
  .min(1)
  .max(512)
  .refine((key) => !key.includes(".."), "object key must not contain '..'")
  .refine((key) => !key.startsWith("/"), "object key must not start with '/'")
  .refine(
    (key) => !key.includes("\\"),
    "object key must not contain backslashes",
  )
  .refine(
    (key) => !/[\r\n\0]/.test(key),
    "object key must not contain control characters",
  )
  .refine(
    (key) =>
      key
        .split("/")
        .every(
          (segment) => encodeURIComponent(segment).length === segment.length,
        ),
    "object key segments must be URI-safe",
  );

export const MimeTypeSchema = z
  .string()
  .regex(/^[\w.+-]+\/[\w.+-]+$/, "MIME type must be a valid type/subtype pair");

export const FileExtensionSchema = z
  .string()
  .regex(/^[a-z0-9]{1,10}$/, "extension must be lowercase alphanumeric");

/**
 * Filename sanitization for storage in metadata: strips directory
 * components and dangerous characters. The sanitized name is NEVER used as
 * an object key (keys are service-generated).
 */
export function sanitizeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? input;
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[^\w.\- ()]/g, "_")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 255) : "unnamed";
}
