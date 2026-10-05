import assert from "node:assert/strict";
import { isRetryable, executeWithRetry } from "../../src/resilience/retry.js";

export async function runRetryTests() {
  console.log("▶ [UNIT] Running Retry tests...");

  const transientError = new Error("Connection reset") as Error & {
    code?: string;
  };
  transientError.code = "ECONNRESET";

  const nonTransientError = new Error("Bad request") as Error & {
    code?: string;
  };
  nonTransientError.code = "ERR_INVALID_ARG";

  // Test 1: GET requests with transient error are retryable
  assert.equal(isRetryable("GET", transientError), true);
  assert.equal(isRetryable("HEAD", transientError), true);

  // Test 2: Non-transient errors are not retryable
  assert.equal(isRetryable("GET", nonTransientError), false);

  // Test 3: POST requests are NOT retryable by default
  assert.equal(isRetryable("POST", transientError), false);
  assert.equal(
    isRetryable("POST", transientError, { isIdempotent: true }),
    true,
  );

  // Test 4: executeWithRetry succeeds after transient failure
  let attempts = 0;
  const result = await executeWithRetry(
    async (attempt) => {
      attempts++;
      if (attempt === 0) {
        throw transientError;
      }
      return "success_on_retry";
    },
    "GET",
    "test-service",
    { maxRetries: 2, backoffMs: 10 },
  );

  assert.equal(result, "success_on_retry");
  assert.equal(attempts, 2);

  // Test 5: executeWithRetry does NOT retry non-retryable POST
  let postAttempts = 0;
  await assert.rejects(async () => {
    await executeWithRetry(
      async () => {
        postAttempts++;
        throw transientError;
      },
      "POST",
      "payment-service",
      { maxRetries: 2, backoffMs: 10 },
    );
  }, /Connection reset/);
  assert.equal(
    postAttempts,
    1,
    "Financial POST must not be retried automatically",
  );

  console.log("✔ [UNIT] Retry tests passed");
}
