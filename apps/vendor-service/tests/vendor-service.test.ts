import "reflect-metadata";
import assert from "node:assert/strict";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module.js";
import {
  CreateVendorSchema,
  AttachDocumentSchema,
  AdminRejectVendorSchema,
  AdminApproveVendorSchema,
  VendorRegisteredEventSchema,
  VendorVerificationRequestedEventSchema,
  VendorVerifiedEventSchema,
  VendorRejectedEventSchema,
  VendorSuspendedEventSchema,
  VendorReactivatedEventSchema,
} from "@repo/types";

async function runVendorServiceTests() {
  console.log("==================================================");
  console.log("     VENDOR SERVICE INTEGRATION TEST SUITE        ");
  console.log("==================================================\n");

  const adapter = new FastifyAdapter();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { logger: false },
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const fastify = app.getHttpAdapter().getInstance();

  try {
    // ────────────────────────────────────────────────────────────
    // Test 1: Health & Observability Endpoints
    // ────────────────────────────────────────────────────────────
    console.log("[Test 1] Health & Metrics Endpoints");
    const healthRes = await fastify.inject({
      method: "GET",
      url: "/health",
    });
    assert.equal(healthRes.statusCode, 200);
    const healthData = JSON.parse(healthRes.payload);
    assert.equal(healthData.status, "ok");
    assert.equal(healthData.service, "vendor-service");
    console.log("  ✓ /health returned 200 OK with service identifier");

    const apiHealthRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/vendors/health",
    });
    assert.equal(apiHealthRes.statusCode, 200);
    console.log("  ✓ /api/v1/vendors/health returned 200 OK");

    const metricsRes = await fastify.inject({
      method: "GET",
      url: "/metrics",
    });
    assert.equal(metricsRes.statusCode, 200);
    assert.ok(metricsRes.payload.includes("process_uptime_seconds"));
    console.log("  ✓ /metrics endpoint returned Prometheus metrics");

    // ────────────────────────────────────────────────────────────
    // Test 2: Auth Gating Verification (Missing x-user-id header)
    // ────────────────────────────────────────────────────────────
    console.log(
      "\n[Test 2] Auth Gating (Reject unauthenticated requests with 401)",
    );
    const protectedEndpoints = [
      { method: "POST" as const, url: "/api/v1/vendors", payload: {} },
      { method: "GET" as const, url: "/api/v1/vendors/user/me" },
      { method: "GET" as const, url: "/api/v1/vendors/vnd-test-123" },
      {
        method: "PATCH" as const,
        url: "/api/v1/vendors/vnd-test-123",
        payload: {},
      },
      {
        method: "POST" as const,
        url: "/api/v1/vendors/vnd-test-123/submit-verification",
        payload: {},
      },
      {
        method: "POST" as const,
        url: "/api/v1/vendors/vnd-test-123/documents",
        payload: {},
      },
      { method: "GET" as const, url: "/api/v1/vendors/vnd-test-123/documents" },
    ];

    for (const ep of protectedEndpoints) {
      const res = await fastify.inject({
        method: ep.method,
        url: ep.url,
        payload: ep.payload,
      });
      assert.equal(
        res.statusCode,
        401,
        `Expected ${ep.method} ${ep.url} to reject unauthenticated request with 401`,
      );
    }
    console.log(
      `  ✓ All ${protectedEndpoints.length} merchant endpoints require x-user-id header`,
    );

    // ────────────────────────────────────────────────────────────
    // Test 3: Admin Authorization Protection (Reject non-admin with 403)
    // ────────────────────────────────────────────────────────────
    console.log(
      "\n[Test 3] Admin Authorization (Reject non-admin requests with 403)",
    );
    const adminEndpoints = [
      { method: "GET" as const, url: "/api/v1/admin/vendors" },
      { method: "GET" as const, url: "/api/v1/admin/vendors/vnd-123" },
      {
        method: "POST" as const,
        url: "/api/v1/admin/vendors/vnd-123/approve",
        payload: {},
      },
      {
        method: "POST" as const,
        url: "/api/v1/admin/vendors/vnd-123/reject",
        payload: { reason: "Invalid license" },
      },
      {
        method: "POST" as const,
        url: "/api/v1/admin/vendors/vnd-123/suspend",
        payload: { reason: "Policy violation" },
      },
      {
        method: "POST" as const,
        url: "/api/v1/admin/vendors/vnd-123/reactivate",
        payload: {},
      },
    ];

    for (const ep of adminEndpoints) {
      const res = await fastify.inject({
        method: ep.method,
        url: ep.url,
        headers: {
          "x-user-id": "normal-user-123",
          "x-user-role": "user",
        },
        payload: ep.payload,
      });
      assert.equal(
        res.statusCode,
        403,
        `Expected ${ep.method} ${ep.url} with role=user to return 403`,
      );
    }
    console.log(
      `  ✓ All ${adminEndpoints.length} admin endpoints require admin role or internal secret`,
    );

    // ────────────────────────────────────────────────────────────
    // Test 4: Schema Validation Invariants
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 4] Schema & Boundary Invariant Enforcement");

    // Invalid legal name
    assert.throws(() => {
      CreateVendorSchema.parse({
        legalName: "A", // too short
        organizationType: "LLC",
        registrationNumber: "REG-1",
        taxIdentifier: "TAX-1",
        country: "US",
      });
    });
    console.log("  ✓ Short legalName rejected");

    // Invalid organization type
    assert.throws(() => {
      CreateVendorSchema.parse({
        legalName: "Valid Legal Org LLC",
        organizationType: "NON_EXISTENT_TYPE",
        registrationNumber: "REG-1",
        taxIdentifier: "TAX-1",
        country: "US",
      });
    });
    console.log("  ✓ Invalid organizationType rejected");

    // Invalid document attachment
    assert.throws(() => {
      AttachDocumentSchema.parse({
        documentType: "NOT_VALID",
        mediaFileId: "",
        fileName: "",
        fileSize: -1,
        mimeType: "",
      });
    });
    console.log("  ✓ Malformed document upload rejected");

    // Admin rejection reason length
    assert.throws(() => {
      AdminRejectVendorSchema.parse({ reason: "no" });
    });
    console.log("  ✓ Short admin rejection reason rejected (< 3 chars)");

    const validApprove = AdminApproveVendorSchema.parse({
      reason: "All KYB documents verified successfully",
    });
    assert.equal(
      validApprove.reason,
      "All KYB documents verified successfully",
    );
    console.log("  ✓ Valid admin approval schema parsed cleanly");

    // ────────────────────────────────────────────────────────────
    // Test 5: Kafka Event Payload Contracts
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 5] Kafka Domain Event Payload Validation");

    const regEvent = VendorRegisteredEventSchema.parse({
      vendorId: "vnd-uuid-1",
      ownerUserId: "usr-clerk-99",
      legalName: "Monorepo Trading Inc",
      tradeName: "MonoStore",
      organizationType: "CORPORATION",
      country: "US",
      status: "DRAFT",
      registeredAt: new Date().toISOString(),
    });
    assert.equal(regEvent.vendorId, "vnd-uuid-1");
    assert.equal(regEvent.legalName, "Monorepo Trading Inc");

    const kybRequestedEvent = VendorVerificationRequestedEventSchema.parse({
      vendorId: "vnd-uuid-1",
      workflowType: "MANUAL_ADMIN",
      requestedAt: new Date().toISOString(),
    });
    assert.equal(kybRequestedEvent.workflowType, "MANUAL_ADMIN");

    const verifiedEvent = VendorVerifiedEventSchema.parse({
      vendorId: "vnd-uuid-1",
      verifiedAt: new Date().toISOString(),
      reviewerAdminId: "admin-clerk-1",
    });
    assert.equal(verifiedEvent.reviewerAdminId, "admin-clerk-1");

    const rejectedEvent = VendorRejectedEventSchema.parse({
      vendorId: "vnd-uuid-1",
      reason: "Incomplete tax records",
      rejectedAt: new Date().toISOString(),
      reviewerAdminId: "admin-clerk-1",
    });
    assert.equal(rejectedEvent.reason, "Incomplete tax records");

    const suspendedEvent = VendorSuspendedEventSchema.parse({
      vendorId: "vnd-uuid-1",
      reason: "Compliance review needed",
      suspendedAt: new Date().toISOString(),
      adminUserId: "admin-clerk-1",
    });
    assert.equal(suspendedEvent.reason, "Compliance review needed");

    const reactivatedEvent = VendorReactivatedEventSchema.parse({
      vendorId: "vnd-uuid-1",
      reactivatedAt: new Date().toISOString(),
      adminUserId: "admin-clerk-1",
    });
    assert.ok(reactivatedEvent.reactivatedAt);
    console.log("  ✓ All 6 vendor lifecycle Kafka event contracts verified");

    // ────────────────────────────────────────────────────────────
    // Test 6: Delegated Manage Admin Verification Guard
    // ────────────────────────────────────────────────────────────
    console.log(
      "\n[Test 6] Delegated Manage Admin Authority (ManageAdminGuard)",
    );

    // Standard admin without delegation rejected with 403 on approval
    const nonManageApproveRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/admin/vendors/vnd-test-123/approve",
      headers: {
        "x-user-id": "admin-auditor-1",
        "x-user-role": "admin",
      },
      payload: {
        reason: "Unauthorized attempt without manage_sellers",
      },
    });
    assert.equal(nonManageApproveRes.statusCode, 403);
    const nonManageApproveJson = JSON.parse(nonManageApproveRes.payload);
    assert.equal(nonManageApproveJson.code, "MANAGE_ADMIN_REQUIRED");
    console.log(
      "  ✓ Standard admin without delegation rejected on approval (403 MANAGE_ADMIN_REQUIRED)",
    );

    // Standard admin without delegation rejected with 403 on rejection
    const nonManageRejectRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/admin/vendors/vnd-test-123/reject",
      headers: {
        "x-user-id": "admin-auditor-1",
        "x-user-role": "admin",
      },
      payload: {
        reason: "Unauthorized reject attempt",
      },
    });
    assert.equal(nonManageRejectRes.statusCode, 403);
    const nonManageRejectJson = JSON.parse(nonManageRejectRes.payload);
    assert.equal(nonManageRejectJson.code, "MANAGE_ADMIN_REQUIRED");
    console.log(
      "  ✓ Standard admin without delegation rejected on rejection (403 MANAGE_ADMIN_REQUIRED)",
    );

    // Delegated Manage Admin (x-user-can-manage-sellers: "true") passes ManageAdminGuard
    const manageAdminApproveRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/admin/vendors/vnd-test-123/approve",
      headers: {
        "x-user-id": "admin-delegate-1",
        "x-user-role": "admin",
        "x-user-can-manage-sellers": "true",
      },
      payload: {
        reason: "Legitimate approval by delegated admin",
      },
    });
    assert.notEqual(
      manageAdminApproveRes.statusCode,
      403,
      "Manage Admin should pass ManageAdminGuard",
    );
    console.log(
      "  ✓ Delegated Manage Admin passes ManageAdminGuard on vendor approval",
    );

    // Super Admin passes ManageAdminGuard
    const superAdminApproveRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/admin/vendors/vnd-test-123/approve",
      headers: {
        "x-user-id": "admin-super",
        "x-user-role": "admin",
        "x-user-is-super-admin": "true",
      },
      payload: {
        reason: "Legitimate approval by Super Admin",
      },
    });
    assert.notEqual(
      superAdminApproveRes.statusCode,
      403,
      "Super Admin should pass ManageAdminGuard",
    );
    console.log("  ✓ Super Admin passes ManageAdminGuard on vendor approval");

    console.log("\n==================================================");
    console.log("  ALL VENDOR SERVICE TESTS PASSED SUCCESSFULLY!   ");
    console.log("==================================================\n");
  } finally {
    await app.close();
  }
}

runVendorServiceTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
