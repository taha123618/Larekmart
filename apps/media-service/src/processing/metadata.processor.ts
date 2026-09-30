import { createHash } from "node:crypto";
import sharp from "sharp";
import { isProcessableImage } from "./image.processor.js";

export interface DetailedImageMetadata {
  width: number;
  height: number;
  format: string;
  channels?: number;
  density?: number;
  orientation?: number;
  hasAlpha: boolean;
  space?: string;
  sizeBytes: number;
  checksum: string;
}

/**
 * Calculates cryptographic checksum (SHA-256 by default) for binary content.
 */
export function calculateChecksum(
  buffer: Buffer,
  algorithm: "sha256" | "sha512" = "sha256",
): string {
  return createHash(algorithm).update(buffer).digest("hex");
}

/**
 * Extracts comprehensive image metadata using Sharp.
 */
export async function extractDetailedMetadata(
  buffer: Buffer,
): Promise<DetailedImageMetadata> {
  const checksum = calculateChecksum(buffer);
  const metadata = await sharp(buffer).metadata();

  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? "unknown",
    channels: metadata.channels,
    density: metadata.density,
    orientation: metadata.orientation,
    hasAlpha: Boolean(metadata.hasAlpha),
    space: metadata.space,
    sizeBytes: buffer.length,
    checksum,
  };
}

/**
 * Validates that an image buffer is genuine, processable, within pixel limits,
 * and extracts its dimensions and checksum.
 */
export async function validateAndExtractImage(
  buffer: Buffer,
  maxPixels = 100_000_000,
): Promise<DetailedImageMetadata> {
  if (!isProcessableImage(buffer)) {
    throw new Error("Buffer is not a processable image signature");
  }

  const meta = await extractDetailedMetadata(buffer);
  if (meta.width <= 0 || meta.height <= 0) {
    throw new Error("Image has invalid dimensions (width or height is 0)");
  }

  if (meta.width * meta.height > maxPixels) {
    throw new Error(
      `Image dimensions ${meta.width}x${meta.height} (${meta.width * meta.height}px) exceed the ${maxPixels}px budget`,
    );
  }

  return meta;
}
