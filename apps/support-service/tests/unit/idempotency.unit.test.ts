import "reflect-metadata";
import assert from "node:assert/strict";
import { of, throwError, firstValueFrom } from "rxjs";
import { ConflictException } from "@nestjs/common";
import { IdempotencyInterceptor } from "../../src/common/interceptors/idempotency.interceptor.js";

async function runIdempotencyUnitTests() {
  console.log("==================================================");
  console.log("    SUPPORT SERVICE - IDEMPOTENCY UNIT TESTS      ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  }

  // Helper to create mock execution context & reply
  function createMockContext(
    headers: Record<string, string | undefined>,
    user?: { userId: string },
  ): {
    context: any;
    reply: any;
  } {
    const replyHeaders: Record<string, string> = {};
    const reply: any = {
      statusCode: 200,
      header: (name: string, val: string) => {
        replyHeaders[name.toLowerCase()] = val;
        return reply;
      },
      getHeaders: () => replyHeaders,
    };

    const request: any = {
      headers: { ...headers },
      user,
    };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => reply,
      }),
    };

    return { context, reply };
  }

  console.log("[1. Passthrough Scenarios]");

  await test("Request without Idempotency-Key passes through without Redis locking", async () => {
    let handlerCalled = false;
    const mockNext: any = {
      handle: () => {
        handlerCalled = true;
        return of({ success: true, ticketId: "tkt_123" });
      },
    };

    const mockRedis: any = {
      getClient: () => ({ status: "ready" }),
      getKeys: () => ({ simple: (k: string) => k }),
    };

    const interceptor = new IdempotencyInterceptor(mockRedis);
    const { context } = createMockContext({});

    const result = await firstValueFrom(
      interceptor.intercept(context, mockNext),
    );
    assert.equal(handlerCalled, true);
    assert.deepEqual(result, { success: true, ticketId: "tkt_123" });
  });

  await test("Request with disconnected Redis gracefully falls back to handler", async () => {
    let handlerCalled = false;
    const mockNext: any = {
      handle: () => {
        handlerCalled = true;
        return of({ success: true, fallback: true });
      },
    };

    const mockRedis: any = {
      getClient: () => null, // Redis offline
      getKeys: () => null,
    };

    const interceptor = new IdempotencyInterceptor(mockRedis);
    const { context } = createMockContext({
      "idempotency-key": "idemp-offline-test",
    });

    const result = await firstValueFrom(
      interceptor.intercept(context, mockNext),
    );
    assert.equal(handlerCalled, true);
    assert.deepEqual(result, { success: true, fallback: true });
  });

  console.log("\n[2. Atomic Lease & Replay Scenarios]");

  await test("First request acquires lock, calls handler, and caches result", async () => {
    let handlerExecutions = 0;
    const inMemoryCache = new Map<string, any>();

    const mockClient: any = {
      status: "ready",
      set: async (key: string, val: string, ...args: any[]) => {
        if (args.includes("NX") && inMemoryCache.has(key)) {
          return null; // lock not acquired
        }
        inMemoryCache.set(key, val);
        return "OK";
      },
      get: async (key: string) => inMemoryCache.get(key) || null,
      del: async (key: string) => {
        inMemoryCache.delete(key);
        return 1;
      },
      eval: async () => 1,
    };

    const mockRedis: any = {
      getClient: () => mockClient,
      getKeys: () => ({ simple: (k: string) => `test:${k}` }),
    };

    const interceptor = new IdempotencyInterceptor(mockRedis);
    const { context, reply } = createMockContext({
      "idempotency-key": "idemp-first-run-001",
    });

    const mockNext: any = {
      handle: () => {
        handlerExecutions++;
        return of({ success: true, ticketNumber: "TKT-2026-0001" });
      },
    };

    const res1 = await firstValueFrom(interceptor.intercept(context, mockNext));
    assert.equal(handlerExecutions, 1);
    assert.deepEqual(res1, { success: true, ticketNumber: "TKT-2026-0001" });
    assert.equal(reply.getHeaders()["idempotent-replayed"], undefined);

    // Now test cached replay with same key
    const { context: replayCtx, reply: replayReply } = createMockContext({
      "idempotency-key": "idemp-first-run-001",
    });

    const res2 = await firstValueFrom(
      interceptor.intercept(replayCtx, mockNext),
    );
    assert.equal(handlerExecutions, 1); // Handler was NOT executed again!
    assert.deepEqual(res2, { success: true, ticketNumber: "TKT-2026-0001" });
    assert.equal(replayReply.getHeaders()["idempotent-replayed"], "true");
  });

  await test("In-flight concurrent mutation with same key triggers HTTP 409 Conflict", async () => {
    const mockClient: any = {
      status: "ready",
      set: async () => null, // Lock failed (in flight)
      get: async () =>
        JSON.stringify({ state: "IN_PROGRESS", createdAt: Date.now() }),
      pttl: async () => 8000, // Valid remaining TTL
    };

    const mockRedis: any = {
      getClient: () => mockClient,
      getKeys: () => ({ simple: (k: string) => `test:${k}` }),
    };

    const interceptor = new IdempotencyInterceptor(mockRedis);
    const { context } = createMockContext({
      "idempotency-key": "idemp-concurrent-002",
    });

    const mockNext: any = {
      handle: () => of({ success: true }),
    };

    await assert.rejects(
      async () => {
        await firstValueFrom(interceptor.intercept(context, mockNext));
      },
      (err: any) =>
        err instanceof ConflictException &&
        err.message.includes("currently in-flight"),
    );
  });

  await test("Handler failure safely releases Redis lock to allow retry", async () => {
    let releasedLockKey = "";

    const mockClient: any = {
      status: "ready",
      set: async () => "OK",
      del: async (key: string) => {
        releasedLockKey = key;
        return 1;
      },
    };

    const mockRedis: any = {
      getClient: () => mockClient,
      getKeys: () => ({ simple: (k: string) => `test:${k}` }),
    };

    const interceptor = new IdempotencyInterceptor(mockRedis);
    const { context } = createMockContext({
      "idempotency-key": "idemp-failed-run-003",
    });

    const mockNext: any = {
      handle: () => throwError(() => new Error("Database deadlock")),
    };

    await assert.rejects(
      async () => {
        await firstValueFrom(interceptor.intercept(context, mockNext));
      },
      (err: any) => err.message === "Database deadlock",
    );

    // Verify lock was released
    assert.ok(releasedLockKey.includes("idemp-failed-run-003"));
  });

  await test("User isolation: identical idempotency key from different users executes separately without collision", async () => {
    let handlerExecutions = 0;
    const inMemoryCache = new Map<string, any>();

    const mockClient: any = {
      status: "ready",
      set: async (key: string, val: string, ...args: any[]) => {
        if (args.includes("NX") && inMemoryCache.has(key)) {
          return null;
        }
        inMemoryCache.set(key, val);
        return "OK";
      },
      get: async (key: string) => inMemoryCache.get(key) || null,
      del: async (key: string) => {
        inMemoryCache.delete(key);
        return 1;
      },
      eval: async () => 1,
    };

    const mockRedis: any = {
      getClient: () => mockClient,
      getKeys: () => ({ simple: (k: string) => `test:${k}` }),
    };

    const interceptor = new IdempotencyInterceptor(mockRedis);
    const mockNext: any = {
      handle: () => {
        handlerExecutions++;
        return of({ success: true, execution: handlerExecutions });
      },
    };

    // User A executes mutation with key "same-key-001"
    const { context: userACtx } = createMockContext(
      { "idempotency-key": "same-key-001" },
      { userId: "user_A" },
    );
    const resA = await firstValueFrom(
      interceptor.intercept(userACtx, mockNext),
    );
    assert.equal(handlerExecutions, 1);
    assert.deepEqual(resA, { success: true, execution: 1 });

    // User B executes mutation with the exact same key "same-key-001"
    const { context: userBCtx, reply: userBReply } = createMockContext(
      { "idempotency-key": "same-key-001" },
      { userId: "user_B" },
    );
    const resB = await firstValueFrom(
      interceptor.intercept(userBCtx, mockNext),
    );
    // Must execute handler for User B (not replaying User A's cached response)
    assert.equal(handlerExecutions, 2);
    assert.deepEqual(resB, { success: true, execution: 2 });
    assert.equal(userBReply.getHeaders()["idempotent-replayed"], undefined);
  });

  console.log("\n==================================================");
  console.log(
    `  IDEMPOTENCY UNIT TESTS COMPLETED: ${passed} passed, ${failed} failed`,
  );
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runIdempotencyUnitTests().catch((err) => {
  console.error("FATAL in idempotency unit tests:", err);
  process.exit(1);
});
