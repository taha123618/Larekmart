import assert from "node:assert/strict";
import { createObjectStorage } from "../../src/storage/index.js";
import { S3StorageProvider } from "../../src/storage/s3.provider.js";
import { MinioStorageProvider } from "../../src/storage/minio.provider.js";

export async function runStorageTests(): Promise<void> {
  console.log("--- Storage Provider Tests ---");

  // 1. Factory returns ObjectStorage
  const storage = createObjectStorage();
  assert.equal(typeof storage.createUploadUrl, "function");
  assert.equal(typeof storage.createDownloadUrl, "function");
  assert.equal(typeof storage.exists, "function");
  assert.equal(typeof storage.deleteObject, "function");
  assert.equal(typeof storage.getMetadata, "function");
  assert.equal(typeof storage.getObjectBuffer, "function");
  assert.equal(typeof storage.putObject, "function");
  assert.equal(typeof storage.checkConnectivity, "function");

  // 2. Mock memory storage provider implementing the same contract
  const memoryStore = new Map<
    string,
    { buffer: Buffer; contentType: string }
  >();
  const mockStorage = {
    async createUploadUrl(input: { key: string }) {
      return {
        url: `https://storage.local/upload/${input.key}`,
        expiresAt: new Date(Date.now() + 900000),
      };
    },
    async createDownloadUrl(input: { key: string }) {
      return {
        url: `https://storage.local/download/${input.key}`,
        expiresAt: new Date(Date.now() + 900000),
      };
    },
    async exists(key: string) {
      return memoryStore.has(key);
    },
    async deleteObject(key: string) {
      memoryStore.delete(key);
    },
    async getMetadata(bucket: string, key: string) {
      const item = memoryStore.get(key);
      return {
        exists: Boolean(item),
        contentLength: item?.buffer.length,
        contentType: item?.contentType,
      };
    },
    async getObjectBuffer(bucket: string, key: string) {
      const item = memoryStore.get(key);
      if (!item) throw new Error("Not found");
      return item.buffer;
    },
    async putObject(
      bucket: string,
      key: string,
      body: Buffer,
      contentType: string,
    ) {
      memoryStore.set(key, { buffer: body, contentType });
    },
    async checkConnectivity() {
      return true;
    },
  };

  // Verify memory store operations
  await mockStorage.putObject(
    "media",
    "test/obj1.txt",
    Buffer.from("hello"),
    "text/plain",
  );
  assert.equal(await mockStorage.exists("test/obj1.txt"), true);
  const meta = await mockStorage.getMetadata("media", "test/obj1.txt");
  assert.equal(meta.exists, true);
  assert.equal(meta.contentLength, 5);

  const buf = await mockStorage.getObjectBuffer("media", "test/obj1.txt");
  assert.equal(buf.toString(), "hello");

  await mockStorage.deleteObject("test/obj1.txt");
  assert.equal(await mockStorage.exists("test/obj1.txt"), false);

  console.log("✓ Storage provider tests passed\n");
}
