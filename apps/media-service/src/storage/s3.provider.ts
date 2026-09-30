import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  CreateDownloadUrlInput,
  CreateUploadUrlInput,
  DownloadUrl,
  ObjectMetadata,
  ObjectStorage,
  UploadUrl,
} from "./object-storage.js";
import { StorageError } from "../errors/errors.js";
import { mediaMetrics, logger } from "../observability/metrics.js";

/**
 * S3-compatible provider. The same implementation serves AWS S3 in production
 * and MinIO in development: MinIO is reached purely through the standard S3
 * API (endpoint + path-style addressing), with no MinIO-specific business
 * logic anywhere.
 */
export class S3StorageProvider implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  }) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  /** Wraps an SDK call with counters + safe error mapping. */
  private async withMetrics<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    mediaMetrics.s3_operation_total.inc({ operation });
    try {
      return await fn();
    } catch (error) {
      mediaMetrics.s3_operation_failures_total.inc({ operation });
      logger.error(`S3 ${operation} failed`, error);
      throw new StorageError(`Storage operation '${operation}' failed`);
    }
  }

  async createUploadUrl(input: CreateUploadUrlInput): Promise<UploadUrl> {
    const command = new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const url = await this.withMetrics("presign_upload", () =>
      getSignedUrl(this.client, command, {
        expiresIn: input.expiresInSeconds,
      }),
    );
    return { url, expiresAt };
  }

  async createDownloadUrl(input: CreateDownloadUrlInput): Promise<DownloadUrl> {
    const command = new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      ResponseContentDisposition: input.downloadFilename
        ? `attachment; filename="${input.downloadFilename}"`
        : undefined,
    });
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const url = await this.withMetrics("presign_download", () =>
      getSignedUrl(this.client, command, {
        expiresIn: input.expiresInSeconds,
      }),
    );
    return { url, expiresAt };
  }

  async exists(key: string): Promise<boolean> {
    const metadata = await this.getMetadata(this.bucket, key);
    return metadata.exists;
  }

  async getMetadata(bucket: string, key: string): Promise<ObjectMetadata> {
    return this.withMetrics("head_object", async () => {
      try {
        const response = await this.client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        return {
          exists: true,
          contentType: response.ContentType,
          contentLength: response.ContentLength,
          lastModified: response.LastModified,
          etag: response.ETag,
        };
      } catch (error) {
        const name = (error as { name?: string }).name;
        // A missing object is an expected outcome, not a storage failure.
        if (name === "NotFound" || name === "NoSuchKey" || name === "404") {
          return { exists: false };
        }
        throw error;
      }
    });
  }

  async deleteObject(key: string): Promise<void> {
    await this.withMetrics("delete_object", () =>
      this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      ),
    );
  }

  async getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
    return this.withMetrics("get_object", async () => {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) throw new StorageError("Empty object body");
      return Buffer.from(bytes);
    });
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.withMetrics("put_object", () =>
      this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      ),
    );
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
