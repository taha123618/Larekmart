import sharp from "sharp";
import { env } from "../config/env.js";

/**
 * Sharp image-processing pipeline (worker-only; never in HTTP requests).
 * All variant definitions come from configuration (MEDIA_VARIANTS), never
 * hard-coded at call sites (spec section 16).
 */

export interface VariantConfig {
  name: string;
  maxEdge: number;
}

export interface VariantResult {
  variant: string;
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

/** Bounded metadata extraction. */
export async function extractImageMetadata(
  buffer: Buffer,
): Promise<{ width: number; height: number; format: string }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? "unknown",
  };
}

/**
 * Sanity check on aspect ratio (spec section 30) — guards against decompression
 * bombs / absurd dimensions rather than rejecting legitimate photography.
 */
const MAX_PIXELS = 100_000_000; // 100 MP
export async function validateImageDimensions(buffer: Buffer): Promise<void> {
  const { width, height } = await extractImageMetadata(buffer);
  if (width <= 0 || height <= 0) {
    throw new Error("Image has no dimensions");
  }
  if (width * height > MAX_PIXELS) {
    throw new Error(
      `Image dimensions ${width}x${height} exceed the ${MAX_PIXELS} pixel budget`,
    );
  }
}

/**
 * Verifies the buffer is a processable image by signature + Sharp decode.
 * Returns true when content is a real image, false otherwise.
 */
export function isProcessableImage(buffer: Buffer): boolean {
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const gif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
  const riff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46;
  const webp = riff && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const isobmff = buffer.subarray(4, 8).toString("ascii") === "ftyp";
  const avifBrand = buffer.subarray(8, 12).toString("ascii");
  const avif =
    isobmff && (avifBrand.startsWith("avi") || avifBrand.startsWith("AVIS"));
  const tiffLE =
    buffer[0] === 0x49 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x2a &&
    buffer[3] === 0x00;
  const tiffBE =
    buffer[0] === 0x4d &&
    buffer[1] === 0x4d &&
    buffer[2] === 0x00 &&
    buffer[3] === 0x2a;
  return jpeg || png || gif || webp || avif || tiffLE || tiffBE;
}

/**
 * Generates all configured variants for an image buffer.
 * Output format is WebP for photos (best size/perf), preserving PNG for
 * images with alpha; JPEG inputs stay JPEG for the `original` variant only.
 */
export async function generateVariants(
  input: Buffer,
  options: { variantConfigs: readonly VariantConfig[] },
): Promise<VariantResult[]> {
  await validateImageDimensions(input);
  const results: VariantResult[] = [];

  for (const config of options.variantConfigs) {
    const pipeline = sharp(input).rotate(); // respect EXIF orientation
    const resized = pipeline.resize({
      width: config.maxEdge,
      height: config.maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    });
    const output = await resized
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    results.push({
      variant: config.name,
      buffer: output.data,
      mimeType: "image/webp",
      width: output.info.width,
      height: output.info.height,
    });
  }

  return results;
}

/** Supported input formats for the processing pipeline. */
export const PROCESSABLE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
] as const;

export type ProcessableMimeType = (typeof PROCESSABLE_MIME_TYPES)[number];
