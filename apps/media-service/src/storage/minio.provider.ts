import { S3StorageProvider } from "./s3.provider.js";

/**
 * MinIO provider. MinIO implements the S3 API, so development uses the same
 * AWS SDK client pointed at the local MinIO endpoint with path-style
 * addressing. This class exists to give the development setup an explicit
 * name and a place for MinIO-specific defaults — never MinIO-specific
 * business logic (spec section 12/44).
 */
export class MinioStorageProvider extends S3StorageProvider {
  constructor(options: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
  }) {
    super({
      endpoint: options.endpoint,
      region: options.region ?? "us-east-1",
      bucket: options.bucket,
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      forcePathStyle: true, // MinIO requires path-style addressing
    });
  }
}
