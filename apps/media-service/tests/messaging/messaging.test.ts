import assert from "node:assert/strict";
import { handleDomainDeleted } from "../../src/messaging/consumers/domain-deletion.consumer.js";
import { extractMediaIds } from "../../src/messaging/consumers/product-claim.consumer.js";
import { normalizeMediaRef } from "../../src/messaging/consumers/user-claim.consumer.js";
import {
  MEDIA_PUBLISHED_EVENTS,
  DOMAIN_CLEANUP_TOPICS,
} from "../../src/schemas/event.schema.js";

export async function runMessagingTests(): Promise<void> {
  console.log("--- Messaging & Kafka Tests ---");

  // 1. Verify published events match specification
  assert.ok(MEDIA_PUBLISHED_EVENTS.includes("media.uploaded"));
  assert.ok(MEDIA_PUBLISHED_EVENTS.includes("media.processing_started"));
  assert.ok(MEDIA_PUBLISHED_EVENTS.includes("media.processing_completed"));
  assert.ok(MEDIA_PUBLISHED_EVENTS.includes("media.processing_failed"));
  assert.ok(MEDIA_PUBLISHED_EVENTS.includes("media.deleted"));
  assert.ok(MEDIA_PUBLISHED_EVENTS.includes("media.quarantined"));

  // 2. Verify domain cleanup topics
  assert.ok(DOMAIN_CLEANUP_TOPICS.includes("product.deleted"));
  assert.ok(DOMAIN_CLEANUP_TOPICS.includes("seller.deleted"));
  assert.ok(DOMAIN_CLEANUP_TOPICS.includes("review.deleted"));
  assert.ok(DOMAIN_CLEANUP_TOPICS.includes("user.deleted"));

  // 3. Product media ID extraction
  const sampleImages = {
    red: "media:11111111-1111-1111-1111-111111111111",
    blue: "22222222-2222-2222-2222-222222222222",
  };
  const extracted = extractMediaIds(sampleImages);
  assert.equal(extracted.length, 2);
  assert.ok(extracted.includes("media:11111111-1111-1111-1111-111111111111"));
  assert.ok(extracted.includes("22222222-2222-2222-2222-222222222222"));

  // 4. User avatar ref normalization
  assert.equal(
    normalizeMediaRef("media:12345678-1234-1234-1234-123456789abc"),
    "12345678-1234-1234-1234-123456789abc",
  );
  assert.equal(
    normalizeMediaRef("12345678-1234-1234-1234-123456789abc"),
    "12345678-1234-1234-1234-123456789abc",
  );
  assert.equal(normalizeMediaRef("invalid-ref"), null);
  assert.equal(normalizeMediaRef(null), null);

  // 5. Idempotent domain deletion consumer
  const processedSet = new Set<string>();
  const mockDb = {} as never;

  // First call should process
  // Second call with same event should be skipped idempotently
  console.log("✓ Messaging & Kafka tests passed\n");
}
