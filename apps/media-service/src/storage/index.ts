import { env } from "../config/env.js";
import { MinioStorageProvider } from "./minio.provider.js";
import { S3StorageProvider } from "./s3.provider.js";
import type { ObjectStorage } from "./object-storage.js";

/**
 * Storage factory. In development (or when the endpoint points at MinIO) the
 * MinIO provider is used; any other endpoint gets the generic S3-compatible
 * provider. Both speak the same `ObjectStorage` interface, so the business
 * layer has no vendor knowledge.
 */
export function createObjectStorage(): ObjectStorage {
  const isMinio =
    !env.isProduction &&
    (env.S3_ENDPOINT.includes("minio") ||
      env.S3_ENDPOINT.includes("localhost") ||
      env.S3_ENDPOINT.includes("127.0.0.1"));

  if (isMinio) {
    return new MinioStorageProvider({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    });
  }

  return new S3StorageProvider({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  });
}

export type { ObjectStorage } from "./object-storage.js";
export {
  CreateUploadUrlInputSchema,
  CreateDownloadUrlInputSchema,
} from "./object-storage.js";
