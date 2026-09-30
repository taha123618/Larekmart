import assert from "node:assert/strict";
import {
  buildOriginalObjectKey,
  buildVariantObjectKey,
  extensionFromFilename,
} from "../../src/storage/object-keys.js";
import {
  ObjectKeySchema,
  sanitizeFilename,
  BucketNameSchema,
} from "../../src/processing/validation.js";
import {
  detectMimeType,
  extensionMatchesMime,
  limitForCategory,
} from "../../src/schemas/upload.schema.js";
import { isProcessableImage } from "../../src/processing/image.processor.js";
import {
  calculateChecksum,
  extractDetailedMetadata,
} from "../../src/processing/metadata.processor.js";
import { env } from "../../src/config/env.js";

export async function runUnitValidationTests(): Promise<void> {
  console.log("--- Unit: Keys, MIME, & Validation Tests ---");

  // 1. Object key generation (spec section 13)
  const key1 = buildOriginalObjectKey({
    ownerType: "product",
    ownerId: "product_123",
    mediaId: "media_abc",
    extension: "jpg",
  });
  assert.equal(key1, "products/product_123/media_abc/original.jpg");

  const key2 = buildVariantObjectKey({
    ownerType: "product",
    ownerId: "product_123",
    mediaId: "media_abc",
    variant: "thumbnail",
    mimeType: "image/webp",
  });
  assert.equal(key2, "products/product_123/media_abc/thumbnail.webp");

  assert.equal(
    buildVariantObjectKey({
      ownerType: "seller",
      ownerId: "seller_9",
      mediaId: "m1",
      variant: "logo",
      mimeType: "image/webp",
    }),
    "sellers/seller_9/m1/logo.webp",
  );
  assert.equal(
    buildVariantObjectKey({
      ownerType: "user",
      ownerId: "user_5",
      mediaId: "m2",
      variant: "avatar",
      mimeType: "image/webp",
    }),
    "users/user_5/m2/avatar.webp",
  );

  // Dangerous chars in ownerId are neutralized
  const safe = buildOriginalObjectKey({
    ownerType: "product",
    ownerId: "../../etc/passwd",
    mediaId: "m",
    extension: "jpg",
  });
  assert.ok(!safe.includes(".."), "key must not contain path traversal");

  // Extension extraction
  assert.equal(extensionFromFilename("photo.JPG"), "jpg");
  assert.equal(extensionFromFilename("archive.tar.gz"), "gz");
  assert.equal(extensionFromFilename("noext"), "bin");

  // ObjectKeySchema
  assert.equal(
    ObjectKeySchema.safeParse("products/p1/m1/original.jpg").success,
    true,
  );
  assert.equal(ObjectKeySchema.safeParse("../products/p1").success, false);
  assert.equal(ObjectKeySchema.safeParse("/products/p1").success, false);
  assert.equal(ObjectKeySchema.safeParse("products\\p1").success, false);

  // BucketNameSchema
  assert.equal(BucketNameSchema.safeParse("media").success, true);
  assert.equal(BucketNameSchema.safeParse("my-media-bucket.1").success, true);
  assert.equal(BucketNameSchema.safeParse("UPPERCASE").success, false);
  assert.equal(BucketNameSchema.safeParse("ab").success, false);

  // Filename sanitization
  assert.equal(sanitizeFilename("../../hack.jpg"), "hack.jpg");
  assert.equal(sanitizeFilename("safe-file (1).png"), "safe-file (1).png");

  // Magic bytes detection (spec section 23)
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  const webp = Buffer.concat([
    Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP", "ascii"),
  ]);
  const pdf = Buffer.from("%PDF-1.7\n");

  assert.equal(detectMimeType(jpeg), "image/jpeg");
  assert.equal(detectMimeType(png), "image/png");
  assert.equal(detectMimeType(gif), "image/gif");
  assert.equal(detectMimeType(webp), "image/webp");
  assert.equal(detectMimeType(pdf), "application/pdf");
  assert.equal(detectMimeType(Buffer.from("not an image")), null);

  // isProcessableImage
  assert.equal(isProcessableImage(jpeg), true);
  assert.equal(isProcessableImage(png), true);
  assert.equal(isProcessableImage(Buffer.from("plain text")), false);

  // Extension matching
  assert.equal(extensionMatchesMime("jpg", "image/jpeg"), true);
  assert.equal(extensionMatchesMime("jpeg", "image/jpeg"), true);
  assert.equal(extensionMatchesMime("png", "image/png"), true);
  assert.equal(extensionMatchesMime("webp", "image/webp"), true);
  assert.equal(extensionMatchesMime("pdf", "image/jpeg"), false);

  // Category limits
  assert.equal(limitForCategory("avatar"), 2 * 1024 * 1024);
  assert.equal(limitForCategory("product-image"), 10 * 1024 * 1024);
  assert.equal(limitForCategory("seller-document"), 25 * 1024 * 1024);

  // Metadata processor checksum calculation
  const sampleBuf = Buffer.from("test media content");
  const checksum = calculateChecksum(sampleBuf);
  assert.equal(typeof checksum, "string");
  assert.equal(checksum.length, 64); // SHA-256 is 64 hex characters

  console.log("✓ Unit validation tests passed\n");
}
