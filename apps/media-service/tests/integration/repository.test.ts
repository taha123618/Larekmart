import assert from "node:assert/strict";
import {
  media,
  mediaVariants,
  mediaUploads,
  mediaProcessingJobs,
  processedEvents,
} from "../../src/db/schema/index.js";

export async function runIntegrationSchemaTests(): Promise<void> {
  console.log("--- Integration Schema Definition Tests ---");

  // 1. Media table structure
  assert.ok(media.id);
  assert.ok(media.ownerType);
  assert.ok(media.ownerId);
  assert.ok(media.bucket);
  assert.ok(media.objectKey);
  assert.ok(media.originalFilename);
  assert.ok(media.mimeType);
  assert.ok(media.extension);
  assert.ok(media.sizeBytes);
  assert.ok(media.checksum);
  assert.ok(media.status);
  assert.ok(media.visibility);
  assert.ok(media.createdBy);
  assert.ok(media.createdAt);
  assert.ok(media.deletedAt);

  // 2. Media variants table structure
  assert.ok(mediaVariants.id);
  assert.ok(mediaVariants.mediaId);
  assert.ok(mediaVariants.variant);
  assert.ok(mediaVariants.bucket);
  assert.ok(mediaVariants.objectKey);
  assert.ok(mediaVariants.mimeType);

  // 3. Media uploads table structure
  assert.ok(mediaUploads.id);
  assert.ok(mediaUploads.mediaId);
  assert.ok(mediaUploads.objectKey);
  assert.ok(mediaUploads.status);
  assert.ok(mediaUploads.expiresAt);

  // 4. Processing jobs table structure
  assert.ok(mediaProcessingJobs.id);
  assert.ok(mediaProcessingJobs.mediaId);
  assert.ok(mediaProcessingJobs.jobType);
  assert.ok(mediaProcessingJobs.status);
  assert.ok(mediaProcessingJobs.attempts);

  // 5. Processed events table structure
  assert.ok(processedEvents.eventId);
  assert.ok(processedEvents.eventType);
  assert.ok(processedEvents.processedAt);

  console.log("✓ Integration schema definition tests passed\n");
}
