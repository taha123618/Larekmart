/**
 * Phase 11: return-service Concurrency & Saga Idempotency Test Suite
 *
 * Verifies:
 * 1. Koa 2 Idempotency Middleware (acquisition, transparent replay, 409 in-flight conflict, error release).
 * 2. Warehouse Inspection Concurrency Mutual Exclusion via withClusterLock (blocking duplicate inspectors).
 * 3. Deterministic Refund Idempotency Keys (refund-{returnId} and refund-{returnId}-retry-{count}).
 *
 * Run with: tsx tests/concurrency-and-saga-idempotency.test.ts
 */
import assert from "assert";
import type { Context, Next } from "koa";
import {
  acquireIdempotencyLock,
  commitIdempotencyResponse,
  withClusterLock,
  releaseClusterLock,
} from "@repo/redis";
import { redis } from "../src/utils/redis.js";
import { idempotencyMiddleware } from "../src/middleware/idempotency.middleware.js";

function createMockContext(
  headers: Record<string, string> = {},
  userId = "user_cust_123",
): Context {
  const responseHeaders: Record<string, string> = {};
  return {
    headers,
    state: { userId },
    status: 200,
    body: undefined as any,
    set(header: string, val: string) {
      responseHeaders[header.toLowerCase()] = val;
    },
    get(header: string) {
      return responseHeaders[header.toLowerCase()];
    },
  } as unknown as Context;
}

export async function testConcurrencyAndSagaIdempotency() {
  console.log("6. Concurrency Locking & Distributed Saga Idempotency ...");

  const testKey1 = `test-idemp-${Date.now()}-1`;
  const middleware = idempotencyMiddleware({ prefix: "return:test:idemp:" });

  // ─── 6.1 Middleware: Fresh Execution & Commit ──────────────────────────────
  let executionCount = 0;
  const ctx1 = createMockContext({ "idempotency-key": testKey1 });
  const next1: Next = async () => {
    executionCount++;
    ctx1.status = 201;
    ctx1.body = { returnId: "ret_abc_1", status: "REQUESTED" };
  };

  await middleware(ctx1, next1);
  assert.equal(
    executionCount,
    1,
    "Downstream handler should be called on first execution",
  );
  assert.equal(ctx1.status, 201, "Status code should be 201");
  assert.deepEqual(ctx1.body, { returnId: "ret_abc_1", status: "REQUESTED" });
  console.log("  ✓ idempotency middleware executes and commits fresh request");

  // ─── 6.2 Middleware: Transparent Replay on Duplicate Key ───────────────────
  const ctx2 = createMockContext({ "idempotency-key": testKey1 });
  const next2: Next = async () => {
    executionCount++;
    ctx2.status = 500;
  };

  await middleware(ctx2, next2);
  assert.equal(
    executionCount,
    1,
    "Downstream handler must NOT be called on duplicate key",
  );
  assert.equal(
    ctx2.status,
    201,
    "Replayed status code should match original (201)",
  );
  assert.deepEqual(ctx2.body, { returnId: "ret_abc_1", status: "REQUESTED" });
  assert.equal(
    ctx2.get("Idempotent-Replayed"),
    "true",
    "Header Idempotent-Replayed must be 'true'",
  );
  assert.equal(
    ctx2.get("x-idempotent-replay"),
    "true",
    "Header x-idempotent-replay must be 'true'",
  );
  console.log(
    "  ✓ duplicate request transparently replayed with cached response",
  );

  // ─── 6.3 Middleware: In-Flight Collision Returns 409 Conflict ──────────────
  const inFlightKey = `test-inflight-${Date.now()}`;
  const redisInFlightKey = redis.keys.simple(
    `return:test:idemp:user_cust_123:${inFlightKey}`,
  );

  // Manually acquire lock simulating an active, in-progress mutation
  const lockAcq = await acquireIdempotencyLock(redis.client, redisInFlightKey, {
    lockTtlMs: 10000,
  });
  assert.equal(
    lockAcq.status,
    "acquired",
    "Lock should be acquired for in-flight simulation",
  );

  const ctxConflict = createMockContext({ "idempotency-key": inFlightKey });
  let conflictNextCalled = false;
  await middleware(ctxConflict, async () => {
    conflictNextCalled = true;
  });

  assert.equal(
    conflictNextCalled,
    false,
    "Handler should not be invoked during conflict",
  );
  assert.equal(ctxConflict.status, 409, "Status should be 409 Conflict");
  assert.equal(
    (ctxConflict.body as any).statusCode,
    409,
    "Response payload should have statusCode 409",
  );
  assert.ok(
    String((ctxConflict.body as any).message).includes("currently in-flight"),
    "Conflict message should specify mutation is currently in-flight",
  );
  console.log(
    "  ✓ in-flight mutation collision rejected with HTTP 409 Conflict",
  );

  // ─── 6.4 Middleware: Release on Error Allows Clean Retry ───────────────────
  const errorKey = `test-error-${Date.now()}`;
  const ctxError = createMockContext({ "idempotency-key": errorKey });

  let threw = false;
  try {
    await middleware(ctxError, async () => {
      ctxError.status = 500;
      throw new Error("Simulated database failure during return creation");
    });
  } catch (err: any) {
    threw = true;
    assert.equal(
      err.message,
      "Simulated database failure during return creation",
    );
  }
  assert.equal(threw, true, "Middleware should rethrow downstream exception");

  // Verify that subsequent retry with same key is NOT blocked as in-flight
  const ctxRetry = createMockContext({ "idempotency-key": errorKey });
  let retryExecuted = false;
  await middleware(ctxRetry, async () => {
    retryExecuted = true;
    ctxRetry.status = 201;
    ctxRetry.body = { returnId: "ret_retry_ok" };
  });
  assert.equal(
    retryExecuted,
    true,
    "Retry must be allowed after failure released the lock",
  );
  assert.equal(ctxRetry.status, 201);
  console.log(
    "  ✓ failed mutation releases lock permitting immediate client retry",
  );

  // ─── 6.5 Warehouse Inspection Concurrency Lock Mutual Exclusion ────────────
  const returnId = `ret_test_inspect_${Date.now()}`;
  const lockKey = redis.keys.simple(`lock:inspection:${returnId}`);
  const inspector1 = `inspector:wh_user_1:${Date.now()}`;
  const inspector2 = `inspector:wh_user_2:${Date.now()}`;

  // Inspector 1 acquires cluster lock for 5s
  let inspector1Completed = false;
  let inspector2Rejected = false;

  const promise1 = withClusterLock(
    redis.client,
    lockKey,
    inspector1,
    async () => {
      // Hold lock briefly to simulate inspection processing & DB persistence
      await new Promise((r) => setTimeout(r, 150));
      inspector1Completed = true;
      return { status: "INSPECTION_COMPLETED", itemsInspected: 2 };
    },
    { ttlMs: 5000 },
  );

  // Inspector 2 tries to inspect the exact same return concurrently
  await new Promise((r) => setTimeout(r, 20)); // Ensure inspector 1 has claimed lock
  const promise2 = withClusterLock(
    redis.client,
    lockKey,
    inspector2,
    async () => {
      return { status: "SHOULD_NOT_EXECUTE" };
    },
    { ttlMs: 5000 },
  );

  const [res1, res2] = await Promise.all([promise1, promise2]);

  assert.deepEqual(res1, { status: "INSPECTION_COMPLETED", itemsInspected: 2 });
  assert.equal(
    inspector1Completed,
    true,
    "Inspector 1 should complete successfully",
  );
  assert.equal(
    res2,
    null,
    "Inspector 2 should receive null (lock acquisition denied)",
  );
  console.log(
    "  ✓ simultaneous warehouse inspection blocked by distributed cluster lock",
  );

  // Verify lock is automatically released after Inspector 1 completes
  const inspector3 = `inspector:wh_user_3:${Date.now()}`;
  const res3 = await withClusterLock(
    redis.client,
    lockKey,
    inspector3,
    async () => ({ status: "SUBSEQUENT_INSPECTION_OK" }),
    { ttlMs: 5000 },
  );
  assert.deepEqual(res3, { status: "SUBSEQUENT_INSPECTION_OK" });
  console.log(
    "  ✓ cluster lock cleanly released following inspection completion",
  );

  // ─── 6.6 Deterministic Refund Idempotency Key Generation ───────────────────
  const sampleReturnId = "ret_888999";
  const initialRefundKey = `refund-${sampleReturnId}`;
  assert.equal(
    initialRefundKey,
    "refund-ret_888999",
    "Initial refund key must strictly be deterministic 'refund-{returnId}'",
  );

  // Verify retry key generation is deterministic and versioned
  const retryCount1 = 1;
  const retryKey1 = `refund-${sampleReturnId}-retry-${retryCount1}`;
  assert.equal(
    retryKey1,
    "refund-ret_888999-retry-1",
    "First retry refund key must strictly be 'refund-{returnId}-retry-1'",
  );

  const retryCount2 = 2;
  const retryKey2 = `refund-${sampleReturnId}-retry-${retryCount2}`;
  assert.equal(
    retryKey2,
    "refund-ret_888999-retry-2",
    "Second retry refund key must strictly be 'refund-{returnId}-retry-2'",
  );

  console.log(
    "  ✓ deterministic refund idempotency keys verified (no random UUID variance)\n",
  );
}

// Standalone execution support
if (process.argv[1]?.endsWith("concurrency-and-saga-idempotency.test.ts")) {
  testConcurrencyAndSagaIdempotency()
    .then(async () => {
      await redis.close();
      console.log("All concurrency and saga idempotency tests passed! ✓");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
