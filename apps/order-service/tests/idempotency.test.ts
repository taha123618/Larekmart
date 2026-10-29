/**
 * Test Suite: Distributed Idempotency Key Engine Invariants
 *
 * Verifies:
 * 1. Atomic Lock Acquisition: First attempt with an Idempotency-Key acquires in-flight lock.
 * 2. In-Flight Conflict Rejection: Concurrent duplicates with the same key receive 409 Conflict.
 * 3. Atomic Response Commitment: Completed responses are cached in Redis with durable TTL.
 * 4. Transparent Replay: Subsequent requests replay the cached response with Idempotent-Replayed: true.
 * 5. Failure Release: Errors release the lock, allowing legitimate client retries.
 */

import assert from "node:assert";
import {
  acquireIdempotencyLock,
  commitIdempotencyResponse,
  releaseIdempotencyLock,
} from "@repo/redis";
import { redis } from "../src/utils/redis.js";
import { executeWithIdempotency } from "../src/middleware/idempotency.js";

async function runIdempotencyTests() {
  console.log(
    "=== Running Distributed Idempotency Key Invariants Test Suite ===\n",
  );

  const testKey = redis.keys.simple(`test:idemp:${Date.now()}`);

  try {
    // 1. First Lock Acquisition
    console.log("1. Testing first lock acquisition...");
    const lock1 = await acquireIdempotencyLock(redis.client, testKey, {
      lockTtlMs: 10000,
    });
    assert.equal(
      lock1.status,
      "acquired",
      "First attempt must acquire the lock",
    );
    console.log("   ✔ Lock successfully acquired on attempt 1");

    // 2. Concurrent Duplicate Rejection
    console.log("2. Testing concurrent duplicate rejection (in-flight)...");
    const lock2 = await acquireIdempotencyLock(redis.client, testKey, {
      lockTtlMs: 10000,
    });
    assert.equal(
      lock2.status,
      "conflict",
      "Concurrent duplicate must return conflict",
    );
    if (lock2.status === "conflict") {
      assert.ok(lock2.message.includes("in-flight"));
    }
    console.log("   ✔ Concurrent in-flight duplicate rejected with conflict");

    // 3. Commit Response
    console.log("3. Testing atomic response commitment...");
    const mockResponse = {
      statusCode: 201,
      body: { orderId: "ord_test_999", amount: 4500, status: "success" },
    };
    const committed = await commitIdempotencyResponse(
      redis.client,
      testKey,
      mockResponse,
      { retentionTtlSec: 60 },
    );
    assert.ok(committed, "Response commitment must succeed");
    console.log("   ✔ Response committed to Redis");

    // 4. Transparent Replay
    console.log("4. Testing transparent replay of completed mutation...");
    const lock3 = await acquireIdempotencyLock(redis.client, testKey);
    assert.equal(
      lock3.status,
      "replayed",
      "Completed mutation must return replayed status",
    );
    if (lock3.status === "replayed") {
      assert.equal(lock3.response.statusCode, 201);
      assert.deepEqual(lock3.response.body, mockResponse.body);
    }
    console.log("   ✔ Cached response cleanly replayed without re-execution");

    // 5. Failure Release
    console.log("5. Testing lock release on error...");
    const failKey = redis.keys.simple(`test:fail:${Date.now()}`);
    await acquireIdempotencyLock(redis.client, failKey, { lockTtlMs: 10000 });
    const released = await releaseIdempotencyLock(redis.client, failKey);
    assert.ok(released, "Lock release must succeed");

    // After release, key can be acquired again
    const lockRetry = await acquireIdempotencyLock(redis.client, failKey);
    assert.equal(
      lockRetry.status,
      "acquired",
      "Retry after release must succeed",
    );
    await releaseIdempotencyLock(redis.client, failKey);
    console.log("   ✔ Released lock allows immediate retry");

    // 5b. Stale / Crashed Worker Dangling Lock Auto-Recovery
    console.log("5b. Testing crashed worker dangling lock recovery on client retry...");
    const crashedKey = redis.keys.simple(`test:crashed:${Date.now()}`);
    // Simulate a worker that crashed mid-flight 15 seconds ago (past the 10s strict threshold)
    await redis.client.set(
      crashedKey,
      JSON.stringify({
        state: "IN_PROGRESS",
        createdAt: Date.now() - 15000,
      }),
      "PX",
      10000,
    );

    // Client replays mutation: engine must detect expired/stale lease and reclaim lock atomically
    const lockReclaim = await acquireIdempotencyLock(redis.client, crashedKey, {
      lockTtlMs: 10000,
    });
    assert.equal(
      lockReclaim.status,
      "acquired",
      "Stale lock from crashed worker must be reclaimed rather than returning 409 conflict",
    );
    await releaseIdempotencyLock(redis.client, crashedKey);
    console.log("   ✔ Stale lock from crashed worker successfully reclaimed on client retry");

    // 6. Fastify executeWithIdempotency Integration
    console.log("6. Testing executeWithIdempotency wrapper...");
    let mutationExecutions = 0;
    const testIdempotencyKey = `idemp_req_${Date.now()}`;

    const mockRequest = {
      headers: { "idempotency-key": testIdempotencyKey },
    } as any;

    const createMockReply = () => {
      const headers: Record<string, string> = {};
      let statusCode = 200;
      let sentBody: any = null;

      const reply = {
        header: (name: string, value: string) => {
          headers[name.toLowerCase()] = value;
          return reply;
        },
        status: (code: number) => {
          statusCode = code;
          return reply;
        },
        send: (body: any) => {
          sentBody = body;
          return { statusCode, headers, body: sentBody };
        },
      };
      return { reply, getResult: () => ({ statusCode, headers, sentBody }) };
    };

    // First call: executes mutation
    const mockReply1 = createMockReply();
    await executeWithIdempotency(
      mockRequest,
      mockReply1.reply as any,
      async () => {
        mutationExecutions++;
        return {
          statusCode: 201,
          data: { orderId: "ord_live_777", amount: 1500 },
        };
      },
      { prefix: "test:ord:" },
    );

    assert.equal(
      mutationExecutions,
      1,
      "Handler must be called on first execution",
    );
    assert.equal(mockReply1.getResult().statusCode, 201);
    assert.deepEqual(mockReply1.getResult().sentBody, {
      orderId: "ord_live_777",
      amount: 1500,
    });

    // Second call with same idempotency key: must replay WITHOUT executing mutation
    const mockReply2 = createMockReply();
    await executeWithIdempotency(
      mockRequest,
      mockReply2.reply as any,
      async () => {
        mutationExecutions++;
        return {
          statusCode: 201,
          data: { orderId: "ord_live_777_DUPLICATE", amount: 1500 },
        };
      },
      { prefix: "test:ord:" },
    );

    assert.equal(
      mutationExecutions,
      1,
      "Handler must NOT be called on second request with identical Idempotency-Key",
    );
    assert.equal(mockReply2.getResult().statusCode, 201);
    assert.equal(mockReply2.getResult().headers["idempotent-replayed"], "true");
    assert.deepEqual(mockReply2.getResult().sentBody, {
      orderId: "ord_live_777",
      amount: 1500,
    });
    console.log(
      "   ✔ Duplicate request received Idempotent-Replayed response with 0 extra executions",
    );

    console.log(
      "\n==================================================================",
    );
    console.log("✔ ALL DISTRIBUTED IDEMPOTENCY KEY INVARIANTS PASSED!");
    console.log(
      "==================================================================\n",
    );
  } finally {
    await releaseIdempotencyLock(redis.client, testKey);
    await redis.close();
  }
}

runIdempotencyTests().catch((err) => {
  console.error("❌ Idempotency test failure:", err);
  process.exit(1);
});
