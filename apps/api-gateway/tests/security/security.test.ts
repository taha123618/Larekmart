import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerRequestIdMiddleware } from "../../src/middleware/request-id.js";
import { globalErrorHandler } from "../../src/middleware/error-handler.js";

export async function runSecurityTests() {
  console.log("▶ [SECURITY] Running Security & Header Sanitization tests...");

  const app = Fastify({ logger: false });
  registerRequestIdMiddleware(app);
  app.setErrorHandler(globalErrorHandler);

  // Echo endpoint to inspect what headers reach internal logic
  app.get("/test/echo-headers", async (request) => {
    return {
      headers: request.headers,
    };
  });

  // Failing endpoint to test sanitized error responses
  app.get("/test/trigger-error", async () => {
    const err = new Error(
      "Database postgres://admin:secret@10.0.0.5:5432 failed",
    );
    (err as any).statusCode = 500;
    throw err;
  });

  // Test 1: Forged identity headers from public client are stripped
  const response1 = await app.inject({
    method: "GET",
    url: "/test/echo-headers",
    headers: {
      "x-user-id": "hacker-user-id",
      "x-user-role": "admin",
      "x-internal-secret": "stolen-secret",
    },
  });

  assert.equal(response1.statusCode, 200);
  const body1 = JSON.parse(response1.payload);
  assert.equal(
    body1.headers["x-user-id"],
    undefined,
    "Client x-user-id must be stripped",
  );
  assert.equal(
    body1.headers["x-user-role"],
    undefined,
    "Client x-user-role must be stripped",
  );
  assert.equal(
    body1.headers["x-internal-secret"],
    undefined,
    "Client x-internal-secret must be stripped",
  );

  // Test 2: Request ID is generated and returned in header
  assert.ok(
    response1.headers["x-request-id"],
    "Response must include x-request-id header",
  );
  assert.equal(typeof response1.headers["x-request-id"], "string");

  // Test 3: Existing valid client request ID is preserved
  const clientReqId = "req-custom-client-id-456";
  const response2 = await app.inject({
    method: "GET",
    url: "/test/echo-headers",
    headers: {
      "x-request-id": clientReqId,
    },
  });
  assert.equal(response2.headers["x-request-id"], clientReqId);

  // Test 4: Internal errors are sanitized without leaking connection strings
  const response3 = await app.inject({
    method: "GET",
    url: "/test/trigger-error",
  });
  assert.equal(response3.statusCode, 500);
  const errorBody = JSON.parse(response3.payload);
  assert.ok(errorBody.error, "Should have error field");
  assert.ok(errorBody.requestId, "Error must contain requestId");
  assert.ok(
    !response3.payload.includes("10.0.0.5:5432"),
    "Error must not leak internal IPs or connection strings",
  );

  await app.close();
  console.log("✔ [SECURITY] Security & Header Sanitization tests passed");
}
