import { z } from "zod";
import {
  BucketNameSchema,
  MimeTypeSchema,
  ObjectKeySchema,
} from "../processing/validation.js";

/**
 * Vendor-neutral object-storage abstraction. Business code depends on this
 * interface, never on AWS/MinIO SDK types — swapping S3 for another
 * S3-compatible provider (or MinIO in dev) cannot touch the media domain.
 */

export const CreateUploadUrlInputSchema = z.object({
  bucket: BucketNameSchema,
  key: ObjectKeySchema,
  contentType: MimeTypeSchema,
  contentLength: z.number().int().positive(),
  expiresInSeconds: z.number().int().positive(),
});

export const CreateDownloadUrlInputSchema = z.object({
  bucket: BucketNameSchema,
  key: ObjectKeySchema,
  expiresInSeconds: z.number().int().positive(),
  /** Filename hint for browsers on download. */
  downloadFilename: z.string().max(255).optional(),
});

export type CreateUploadUrlInput = z.infer<typeof CreateUploadUrlInputSchema>;
export type CreateDownloadUrlInput = z.infer<
  typeof CreateDownloadUrlInputSchema
>;

export interface UploadUrl {
  url: string;
  expiresAt: Date;
}

export interface DownloadUrl {
  url: string;
  expiresAt: Date;
}

export interface ObjectMetadata {
  exists: boolean;
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
  etag?: string;
}

/**
 * The storage contract. `getObjectBuffer` is required by the processing
 * worker (Sharp needs bytes); everything else maps to presigned-URL and
 * metadata flows that never proxy binaries through the API.
 */
export interface ObjectStorage {
  createUploadUrl(input: CreateUploadUrlInput): Promise<UploadUrl>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<DownloadUrl>;
  exists(key: string): Promise<boolean>;
  deleteObject(key: string): Promise<void>;
  getMetadata(bucket: string, key: string): Promise<ObjectMetadata>;
  getObjectBuffer(bucket: string, key: string): Promise<Buffer>;
  putObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void>;
  /** Health probe used by /health/ready — must not throw. */
  checkConnectivity(): Promise<boolean>;
}
