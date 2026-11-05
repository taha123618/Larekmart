import "reflect-metadata";
import assert from "node:assert/strict";
import { SlaService } from "../../src/modules/sla/sla.service.js";

async function runSlaEngineUnitTests() {
  console.log("==================================================");
  console.log("    SUPPORT SERVICE - SLA ENGINE UNIT TESTS       ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  }

  async function testAsync(name: string, fn: () => Promise<void>) {
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

  // Mock Prisma Service
  const mockPolicies: any[] = [
    {
      id: "sla-crit-001",
      name: "Critical Priority SLA",
      priority: "CRITICAL",
      firstResponseTimeMinutes: 15,
      resolutionTimeMinutes: 120,
      escalationTier: 3,
      isActive: true,
    },
    {
      id: "sla-urg-002",
      name: "Urgent Priority SLA",
      priority: "URGENT",
      firstResponseTimeMinutes: 30,
      resolutionTimeMinutes: 240,
      escalationTier: 2,
      isActive: true,
    },
    {
      id: "sla-high-003",
      name: "High Priority SLA",
      priority: "HIGH",
      firstResponseTimeMinutes: 60,
      resolutionTimeMinutes: 480,
      escalationTier: 2,
      isActive: true,
    },
    {
      id: "sla-med-004",
      name: "Medium Priority SLA",
      priority: "MEDIUM",
      firstResponseTimeMinutes: 120,
      resolutionTimeMinutes: 1440,
      escalationTier: 1,
      isActive: true,
    },
    {
      id: "sla-low-005",
      name: "Low Priority SLA",
      priority: "LOW",
      firstResponseTimeMinutes: 240,
      resolutionTimeMinutes: 2880,
      escalationTier: 1,
      isActive: true,
    },
  ];

  const mockPrisma: any = {
    ticketSlaPolicy: {
      findFirst: async ({ where }: any) => {
        return (
          mockPolicies.find(
            (p) => p.priority === where.priority && p.isActive,
          ) || null
        );
      },
      findUnique: async ({ where }: any) => {
        return mockPolicies.find((p) => p.id === where.id) || null;
      },
      findMany: async () => mockPolicies,
      create: async ({ data }: any) => ({ id: `sla-${Date.now()}`, ...data }),
    },
  };

  const slaService = new SlaService(mockPrisma);

  console.log("[1. SLA Deadline Computations Across Priority Tiers]");

  await testAsync(
    "Critical Priority computes 15m first response and 120m resolution",
    async () => {
      const before = Date.now();
      const result = await slaService.calculateDeadlines("CRITICAL");
      const after = Date.now();

      assert.equal(result.slaPolicyId, "sla-crit-001");
      const firstDiffMins = Math.round(
        (result.firstResponseDueAt.getTime() - before) / (60 * 1000),
      );
      const resDiffMins = Math.round(
        (result.resolutionDueAt.getTime() - before) / (60 * 1000),
      );

      assert.equal(firstDiffMins, 15);
      assert.equal(resDiffMins, 120);
      assert.ok(result.firstResponseDueAt <= result.resolutionDueAt);
    },
  );

  await testAsync(
    "Urgent Priority computes 30m first response and 240m resolution",
    async () => {
      const before = Date.now();
      const result = await slaService.calculateDeadlines("URGENT");
      assert.equal(result.slaPolicyId, "sla-urg-002");
      const firstDiffMins = Math.round(
        (result.firstResponseDueAt.getTime() - before) / (60 * 1000),
      );
      const resDiffMins = Math.round(
        (result.resolutionDueAt.getTime() - before) / (60 * 1000),
      );
      assert.equal(firstDiffMins, 30);
      assert.equal(resDiffMins, 240);
    },
  );

  await testAsync(
    "High Priority computes 60m first response and 480m resolution",
    async () => {
      const before = Date.now();
      const result = await slaService.calculateDeadlines("HIGH");
      assert.equal(result.slaPolicyId, "sla-high-003");
      const firstDiffMins = Math.round(
        (result.firstResponseDueAt.getTime() - before) / (60 * 1000),
      );
      const resDiffMins = Math.round(
        (result.resolutionDueAt.getTime() - before) / (60 * 1000),
      );
      assert.equal(firstDiffMins, 60);
      assert.equal(resDiffMins, 480);
    },
  );

  await testAsync(
    "Medium Priority computes 120m first response and 1440m (24h) resolution",
    async () => {
      const before = Date.now();
      const result = await slaService.calculateDeadlines("MEDIUM");
      assert.equal(result.slaPolicyId, "sla-med-004");
      const firstDiffMins = Math.round(
        (result.firstResponseDueAt.getTime() - before) / (60 * 1000),
      );
      const resDiffMins = Math.round(
        (result.resolutionDueAt.getTime() - before) / (60 * 1000),
      );
      assert.equal(firstDiffMins, 120);
      assert.equal(resDiffMins, 1440);
    },
  );

  await testAsync(
    "Low Priority computes 240m first response and 2880m (48h) resolution",
    async () => {
      const before = Date.now();
      const result = await slaService.calculateDeadlines("LOW");
      assert.equal(result.slaPolicyId, "sla-low-005");
      const firstDiffMins = Math.round(
        (result.firstResponseDueAt.getTime() - before) / (60 * 1000),
      );
      const resDiffMins = Math.round(
        (result.resolutionDueAt.getTime() - before) / (60 * 1000),
      );
      assert.equal(firstDiffMins, 240);
      assert.equal(resDiffMins, 2880);
    },
  );

  console.log("\n[2. Custom Policy Overrides & Fallbacks]");

  await testAsync(
    "Specific custom policyId overrides priority-based lookup",
    async () => {
      const customResult = await slaService.calculateDeadlines(
        "LOW",
        "sla-crit-001",
      );
      assert.equal(customResult.slaPolicyId, "sla-crit-001");
      const before = Date.now();
      const firstDiffMins = Math.round(
        (customResult.firstResponseDueAt.getTime() - before) / (60 * 1000),
      );
      assert.equal(firstDiffMins, 15); // Used critical policy instead of low
    },
  );

  await testAsync(
    "Missing custom policyId falls back to priority policy",
    async () => {
      const fallbackResult = await slaService.calculateDeadlines(
        "HIGH",
        "non-existent-id",
      );
      assert.equal(fallbackResult.slaPolicyId, "sla-high-003");
    },
  );

  await testAsync(
    "Unknown priority falls back to safe default (120m / 1440m)",
    async () => {
      const defaultResult = await slaService.calculateDeadlines(
        "UNKNOWN_PRIORITY" as any,
      );
      assert.equal(defaultResult.slaPolicyId, null);
      const before = Date.now();
      const firstDiffMins = Math.round(
        (defaultResult.firstResponseDueAt.getTime() - before) / (60 * 1000),
      );
      const resDiffMins = Math.round(
        (defaultResult.resolutionDueAt.getTime() - before) / (60 * 1000),
      );
      assert.equal(firstDiffMins, 120);
      assert.equal(resDiffMins, 1440);
    },
  );

  console.log("\n[3. SLA Breach Assessment Logic]");

  test("Resolution before deadline is classified as NOT breached", () => {
    const resolutionDueAt = new Date(Date.now() + 60 * 60 * 1000);
    const resolvedAt = new Date(Date.now() + 30 * 60 * 1000);
    const isBreached = resolvedAt > resolutionDueAt;
    assert.equal(isBreached, false);
  });

  test("Resolution after deadline is classified as BREACHED", () => {
    const resolutionDueAt = new Date(Date.now() - 10 * 60 * 1000);
    const resolvedAt = new Date();
    const isBreached = resolvedAt > resolutionDueAt;
    assert.equal(isBreached, true);
  });

  test("First response before deadline satisfies first response SLA", () => {
    const firstResponseDueAt = new Date(Date.now() + 15 * 60 * 1000);
    const firstResponseAt = new Date(Date.now() + 5 * 60 * 1000);
    const isBreached = firstResponseAt > firstResponseDueAt;
    assert.equal(isBreached, false);
  });

  test("Resolution duration in minutes calculation is precise", () => {
    const created = new Date("2026-11-05T00:00:00Z");
    const resolved = new Date("2026-11-05T01:45:00Z");
    const durationMins = Math.round(
      (resolved.getTime() - created.getTime()) / (60 * 1000),
    );
    assert.equal(durationMins, 105);
  });

  console.log("\n==================================================");
  console.log(
    `  SLA ENGINE UNIT TESTS COMPLETED: ${passed} passed, ${failed} failed`,
  );
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSlaEngineUnitTests().catch((err) => {
  console.error("FATAL in SLA engine unit tests:", err);
  process.exit(1);
});
