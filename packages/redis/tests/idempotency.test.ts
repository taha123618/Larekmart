import assert from "node:assert/strict";
import {
  claimEventIdempotency,
  acquireIdempotencyLock,
  commitIdempotencyResponse,
  releaseIdempotencyLock,
} from "../src/idempotency.js";

// Mock Redis client for unit testing idempotency primitives
class MockRedisClient {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async set(
    key: string,
    value: string,
    mode1?: string,
    time?: number,
    mode2?: string,
  ): Promise<string | null> {
    const isNx = mode1 === "NX" || mode2 === "NX";
    const isEx = mode1 === "EX";
    const isPx = mode1 === "PX";

    const existing = this.store.get(key);
    const now = Date.now();

    if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
      if (isNx) {
        return null;
      }
    }

    let expiresAt: number | undefined;
    if (isEx && time) {
      expiresAt = now + time * 1000;
    } else if (isPx && time) {
      expiresAt = now + time;
    }

    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    const record = this.store.get(key);
    if (!record) return null;
    if (record.expiresAt && record.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return record.value;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async pttl(key: string): Promise<number> {
    const record = this.store.get(key);
    if (!record || !record.expiresAt) return -1;
    const remaining = record.expiresAt - Date.now();
    return remaining > 0 ? remaining : -2;
  }
}

async function runIdempotencyTests(): Promise<void> {
  console.log("==================================================");
  console.log("⚡ @repo/redis Event & Mutation Idempotency Tests");
  console.log("==================================================");

  const mockRedis = new MockRedisClient() as any;

  // 1. claimEventIdempotency first claim succeeds
  console.log("\n1. Testing claimEventIdempotency first claim...");
  const firstClaim = await claimEventIdempotency(mockRedis, "evt_test_12345", 3600);
  assert.equal(firstClaim, true, "First event claim must return true");
  console.log("  ✓ First event claim succeeded");

  // 2. Duplicate claim with identical event ID is rejected
  console.log("\n2. Testing duplicate claim rejection...");
  const duplicateClaim = await claimEventIdempotency(mockRedis, "evt_test_12345", 3600);
  assert.equal(duplicateClaim, false, "Duplicate event claim must return false");
  console.log("  ✓ Duplicate event claim strictly rejected (deduplicated)");

  // 3. Different event ID succeeds
  console.log("\n3. Testing distinct event ID claim...");
  const differentClaim = await claimEventIdempotency(mockRedis, "evt_test_67890", 3600);
  assert.equal(differentClaim, true, "Distinct event ID must return true");
  console.log("  ✓ Distinct event ID claim succeeded");

  // 4. HTTP Idempotency Lock acquisition, commit, replay
  console.log("\n4. Testing HTTP mutation lock acquisition and response replay...");
  const lock = await acquireIdempotencyLock(mockRedis, "idemp_http_001");
  assert.equal(lock.status, "acquired", "Lock acquisition must succeed");

  await commitIdempotencyResponse(mockRedis, "idemp_http_001", {
    statusCode: 201,
    body: { success: true, orderId: "ord_abc_123" },
  });

  const replay = await acquireIdempotencyLock(mockRedis, "idemp_http_001");
  assert.equal(replay.status, "replayed", "Second call must return replayed response");
  if (replay.status === "replayed") {
    assert.equal(replay.response.statusCode, 201);
  }
  console.log("  ✓ HTTP mutation idempotency lock, commit, and replay verified");

  // 5. Lock release
  console.log("\n5. Testing idempotency lock release...");
  await releaseIdempotencyLock(mockRedis, "idemp_http_001");
  const reacquired = await acquireIdempotencyLock(mockRedis, "idemp_http_001");
  assert.equal(reacquired.status, "acquired", "Released lock can be reacquired");
  console.log("  ✓ Idempotency lock release verified");

  console.log("\n==================================================");
  console.log("🎉 All Idempotency Tests Passed Cleanly!");
  console.log("==================================================");
}

runIdempotencyTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
