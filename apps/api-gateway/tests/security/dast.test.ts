import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildApp } from "../../src/app.js";
import { inFlightBulkhead } from "../../src/resilience/in-flight-bulkhead.js";

function createHmacToken(payload: object, secret?: string) {
  const hmacKey =
    secret ||
    process.env.CLERK_JWT_HMAC_KEY ||
    "larekmart_seller_hmac_secret_dev_key";
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", hmacKey)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

export async function runDastSecurityTests() {
  console.log("=================================================");
  console.log("🛡️  Larekmart Dynamic Application Security Testing (DAST)");
  console.log("    OWASP API Security Top 10 Dynamic Test Suite");
  console.log("=================================================\n");

  const app = await buildApp();
  const now = Math.floor(Date.now() / 1000);

  const adminToken = createHmacToken({
    sub: "usr_admin_dast_999",
    role: "admin",
    exp: now + 3600,
  });

  const customerToken = createHmacToken({
    sub: "usr_cust_dast_111",
    role: "customer",
    exp: now + 3600,
  });

  const sellerToken = createHmacToken({
    sub: "usr_seller_dast_222",
    role: "seller",
    sellerId: "seller_store_222",
    exp: now + 3600,
  });

  try {
    // =========================================================================
    // 1. Perimeter Header Sanitization & Identity Spoofing (OWASP API1 / API5)
    // =========================================================================
    console.log(
      "▶ [DAST 1] Perimeter Header Sanitization & Spoofing Defense...",
    );

    const spoofRes = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-user-id": "spoofed_target_victim_123",
        "x-user-role": "super_admin",
        "x-seller-id": "spoofed_seller_999",
        "x-vendor-id": "spoofed_vendor_888",
        "x-internal-secret": "stolen_cluster_transport_secret",
        "X-USER-ID": "spoofed_caps_victim",
        "X-USER-ROLE": "admin",
      },
    });

    assert.equal(spoofRes.statusCode, 200);
    // Verified that health response succeeds and gateway didn't crash on spoofed headers
    console.log(
      "  ✔ Perimeter accepted request without header poisoning crash",
    );

    // =========================================================================
    // 2. Cryptographic Token Forgery & Auth Edge Cases (OWASP API2)
    // =========================================================================
    console.log(
      "\n▶ [DAST 2] Cryptographic Token Forgery & Auth Bypass Defense...",
    );

    // 2.1: Alg "none" exploit attempt
    const algNoneHeader = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const algNoneBody = Buffer.from(
      JSON.stringify({ sub: "usr_attacker", role: "admin", exp: now + 3600 }),
    ).toString("base64url");
    const algNoneToken = `${algNoneHeader}.${algNoneBody}.`;

    const algNoneRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/feature-flags",
      headers: { authorization: `Bearer ${algNoneToken}` },
    });
    assert.equal(
      algNoneRes.statusCode,
      401,
      "Alg 'none' token must be rejected with 401 Unauthorized",
    );
    console.log("  ✔ Alg 'none' exploit token strictly rejected (401)");

    // 2.2: Tampered payload with valid original signature
    const validParts = adminToken.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: "usr_attacker", role: "admin", exp: now + 3600 }),
    ).toString("base64url");
    const tamperedToken = `${validParts[0]}.${tamperedPayload}.${validParts[2]}`;

    const tamperedRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/feature-flags",
      headers: { authorization: `Bearer ${tamperedToken}` },
    });
    assert.equal(
      tamperedRes.statusCode,
      401,
      "Tampered payload with mismatched signature must be rejected with 401",
    );
    console.log("  ✔ Tampered HMAC signature strictly rejected (401)");

    // 2.3: Expired token
    const expiredToken = createHmacToken({
      sub: "usr_admin_expired",
      role: "admin",
      exp: now - 300, // Expired 5 minutes ago
    });
    const expiredRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/feature-flags",
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(
      expiredRes.statusCode,
      401,
      "Expired token must be rejected with 401",
    );
    console.log("  ✔ Expired JWT strictly rejected (401)");

    // 2.4: Malformed tokens (not base64, missing parts, garbage)
    const malformedTokens = [
      "not-even-a-jwt",
      "header.only-two-parts",
      "....",
      "Bearer ",
      "",
    ];
    for (const badToken of malformedTokens) {
      const badRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/feature-flags",
        headers: { authorization: `Bearer ${badToken}` },
      });
      assert.equal(
        badRes.statusCode,
        401,
        `Malformed token '${badToken}' must be rejected with 401`,
      );
    }
    console.log("  ✔ Malformed and garbage token strings fail closed (401)");

    // 2.5: Non-Bearer authorization header scheme
    const basicAuthRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/feature-flags",
      headers: { authorization: "Basic YWRtaW46cGFzc3dvcmQ=" },
    });
    assert.equal(
      basicAuthRes.statusCode,
      401,
      "Non-Bearer authorization scheme must be rejected with 401",
    );
    console.log("  ✔ Non-Bearer authorization scheme rejected (401)");

    // =========================================================================
    // 3. Broken Function-Level Authorization & Privilege Escalation (OWASP API5)
    // =========================================================================
    console.log(
      "\n▶ [DAST 3] Broken Function-Level Authorization (BFLA) Defense...",
    );

    // 3.1: Unauthenticated request to admin endpoint
    const unauthAdminRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/canary/runs",
    });
    assert.equal(
      unauthAdminRes.statusCode,
      401,
      "Unauthenticated request to admin route must return 401",
    );
    console.log("  ✔ Unauthenticated access to admin endpoints blocked (401)");

    // 3.2: Customer role attempting to access admin canary routes
    const custCanaryRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/canary/runs",
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert.equal(
      custCanaryRes.statusCode,
      403,
      "Customer role must be blocked with 403 Forbidden on admin routes",
    );
    console.log(
      "  ✔ Customer role access to admin canary routes blocked (403)",
    );

    // 3.3: Seller role attempting to access admin feature flags
    const sellerFFRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/feature-flags",
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(
      sellerFFRes.statusCode,
      403,
      "Seller role must be blocked with 403 Forbidden on admin feature flags",
    );
    console.log("  ✔ Seller role access to admin feature flags blocked (403)");

    // 3.4: Customer supplying x-internal-secret header attempting admin bypass (SEC-15)
    const secretBypassRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/feature-flags",
      headers: {
        authorization: `Bearer ${customerToken}`,
        "x-internal-secret":
          process.env.INTERNAL_SERVICE_SECRET || "internal_secret",
      },
    });
    assert.equal(
      secretBypassRes.statusCode,
      403,
      "Transport internal secret must not escalate customer role to admin",
    );
    console.log(
      "  ✔ SEC-15: Transport secret decoupled from admin privileges (403)",
    );

    // 3.5: Valid admin token successfully accesses admin route
    const validAdminRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/feature-flags",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(
      validAdminRes.statusCode,
      200,
      "Legitimate admin must be allowed (200 OK)",
    );
    console.log("  ✔ Legitimate admin token authorized (200 OK)");

    // =========================================================================
    // 4. Broken Object Property Level Authorization & Mass Assignment (OWASP API3)
    // =========================================================================
    console.log("\n▶ [DAST 4] Mass Assignment & Payload Tampering Defense...");

    const flagKey = `dast.test.flag.${Date.now()}`;
    const massAssignRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/feature-flags",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        key: flagKey,
        enabled: true,
        defaultValue: false,
        description: "DAST testing flag",
        // Malicious injected properties attempting mass assignment
        role: "super_admin",
        isSuperAdmin: true,
        permissions: ["*"],
        clusterSecret: "injected_secret",
      },
    });
    assert.equal(
      massAssignRes.statusCode,
      200,
      "Feature flag creation with extra parameters handled safely",
    );
    const flagBody = JSON.parse(massAssignRes.payload);
    assert.equal(
      flagBody.data.role,
      undefined,
      "Injected 'role' property must not be reflected or assigned",
    );
    assert.equal(
      flagBody.data.isSuperAdmin,
      undefined,
      "Injected 'isSuperAdmin' property must not be reflected or assigned",
    );
    console.log("  ✔ Mass assignment properties rejected / stripped cleanly");

    // =========================================================================
    // 5. Unrestricted Resource Consumption & Concurrency Bulkheads (OWASP API4)
    // =========================================================================
    console.log(
      "\n▶ [DAST 5] Resource Consumption & Concurrency Bulkhead Defense...",
    );

    // 5.1: In-flight concurrency bulkhead load-shedding
    // Saturate checkout bulkhead category
    const maxBulkhead = 50;
    for (let i = 0; i < maxBulkhead; i++) {
      inFlightBulkhead.acquire("checkout", maxBulkhead);
    }

    const shedRes = await app.inject({
      method: "POST",
      url: "/api/v1/checkout/orders",
      headers: {
        authorization: `Bearer ${customerToken}`,
        "content-type": "application/json",
      },
      payload: { items: [] },
    });

    assert.equal(
      shedRes.statusCode,
      503,
      "Saturated bulkhead must shed load with 503 Service Unavailable",
    );
    assert.equal(
      shedRes.headers["retry-after"],
      "15",
      "Load shedding response must include 'Retry-After: 15'",
    );
    const shedBody = JSON.parse(shedRes.payload);
    assert.equal(shedBody.statusCode, 503);
    assert.ok(shedBody.message.includes("Shedding load"));

    // Reset bulkhead for downstream tests
    inFlightBulkhead.reset();
    console.log(
      "  ✔ In-flight concurrency bulkhead shedding verified (503 + Retry-After: 15)",
    );

    // 5.2: Oversized Request Body (Denial of Service mitigation)
    const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, "A"); // 6MB (exceeds 5MB bodyLimit)
    const oversizedRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/feature-flags",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: oversizedBuffer,
    });
    assert.equal(
      oversizedRes.statusCode,
      413,
      "Oversized request payload must be rejected with 413 Payload Too Large",
    );
    console.log(
      "  ✔ Oversized body payload (>5MB) rejected with 413 Payload Too Large",
    );

    // =========================================================================
    // 6. Defensive Security Headers Verification (OWASP API8)
    // =========================================================================
    console.log("\n▶ [DAST 6] Defensive Security Response Headers...");

    const headerRes = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.equal(
      headerRes.headers["x-content-type-options"],
      "nosniff",
      "Must include X-Content-Type-Options: nosniff",
    );
    assert.equal(
      headerRes.headers["x-frame-options"],
      "DENY",
      "Must include X-Frame-Options: DENY",
    );
    assert.ok(
      headerRes.headers["x-request-id"],
      "Must include X-Request-ID for distributed tracing",
    );
    console.log(
      "  ✔ Standard defensive headers verified (nosniff, DENY, x-request-id)",
    );

    // =========================================================================
    // 7. Malicious Injection Resilience (SQLi / NoSQLi / Traversal) (OWASP API10)
    // =========================================================================
    console.log("\n▶ [DAST 7] Malicious Injection Resilience...");

    // 7.1: SQL injection in query parameters
    const sqliQueries = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "1 UNION SELECT null, null, null--",
      "admin'--",
    ];
    for (const payload of sqliQueries) {
      const sqliRes = await app.inject({
        method: "GET",
        url: `/health?query=${encodeURIComponent(payload)}`,
      });
      assert.equal(sqliRes.statusCode, 200);
      assert.ok(
        !sqliRes.payload.toLowerCase().includes("syntax error"),
        "SQL injection payload must never leak SQL engine syntax errors",
      );
    }
    console.log(
      "  ✔ SQL injection query payloads handled safely without syntax leaks",
    );

    // 7.2: Path traversal attempt in URL
    const traversalUrls = [
      "/api/v1/../../../../etc/passwd",
      "/api/v1/%2e%2e/%2e%2e/etc/passwd",
      "/health/../../../secret.env",
    ];
    for (const url of traversalUrls) {
      const travRes = await app.inject({
        method: "GET",
        url,
      });
      assert.ok(
        travRes.statusCode === 400 || travRes.statusCode === 404,
        `Path traversal URL '${url}' must return 400 or 404, got ${travRes.statusCode}`,
      );
      assert.ok(
        !travRes.payload.includes("root:"),
        "Path traversal must not leak system files",
      );
    }
    console.log("  ✔ Path traversal attempts blocked safely (400/404)");

    // 7.3: Null byte injection
    const nullByteRes = await app.inject({
      method: "GET",
      url: "/health%00.txt",
    });
    assert.ok(
      nullByteRes.statusCode === 400 || nullByteRes.statusCode === 404,
      "Null byte URL must be safely rejected (400 or 404)",
    );
    console.log("  ✔ Null byte injection handled safely");

    // =========================================================================
    // 8. Information Disclosure & Error Sanitization (OWASP API8)
    // =========================================================================
    console.log(
      "\n▶ [DAST 8] Error Sanitization & Information Disclosure Defense...",
    );

    const notFoundRes = await app.inject({
      method: "GET",
      url: "/api/v1/non-existent-shadow-route-probe-404",
    });
    assert.equal(notFoundRes.statusCode, 404);
    assert.ok(
      !notFoundRes.payload.includes("/Users/"),
      "404 error response must not leak local filesystem paths",
    );
    assert.ok(
      !notFoundRes.payload.includes("postgres://"),
      "404 error response must not leak database connection strings",
    );
    assert.ok(
      !notFoundRes.payload.includes("10.0."),
      "404 error response must not leak private IP addresses",
    );
    console.log(
      "  ✔ Error responses strictly sanitized; zero credentials or paths disclosed",
    );

    await app.close();
    console.log("\n=================================================");
    console.log("✅ Dynamic Application Security Testing (DAST) Passed 100%!");
    console.log("=================================================\n");
  } catch (error) {
    await app.close();
    throw error;
  }
}
