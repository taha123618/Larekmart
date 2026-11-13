import assert from "node:assert/strict";
import {
  createFeatureFlagEngine,
  type FeatureFlagDefinition,
  type EvaluationContext,
} from "../src/feature-flags.js";

// In-memory mock Redis for isolated unit testing
class MockRedis {
  public store = new Map<string, string>();
  public publishLog: { channel: string; message: string }[] = [];

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<string> {
    this.store.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.replace("*", "");
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return keys.map((k) => this.store.get(k) ?? null);
  }

  async publish(channel: string, message: string): Promise<number> {
    this.publishLog.push({ channel, message });
    return 1;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("⚡ @repo/redis Dynamic Feature Flagging Tests");
  console.log("==================================================");

  const mockRedis = new MockRedis() as any;
  const engine = createFeatureFlagEngine({
    redis: mockRedis,
    cacheTtlMs: 5000,
  });

  // 1. Basic Boolean Flag Evaluation
  console.log("\n1. Testing basic boolean flag evaluation...");
  const booleanFlag: FeatureFlagDefinition<boolean> = {
    key: "checkout.instant_buy",
    enabled: true,
    defaultValue: true,
    description: "Enable 1-click buy button on product detail page",
  };
  await engine.setFlag(booleanFlag);

  const eval1 = await engine.getBooleanValue("checkout.instant_buy", false);
  assert.equal(eval1, true, "Enabled boolean flag should return true");

  const fullEval1 = await engine.evaluate("checkout.instant_buy", false);
  assert.equal(fullEval1.reason, "STATIC");
  console.log("  ✓ Basic boolean flag evaluated successfully");

  // 2. Disabled Flag Fallback
  console.log("\n2. Testing disabled flag evaluation...");
  await engine.toggleFlag("checkout.instant_buy", false);
  const eval2 = await engine.getBooleanValue("checkout.instant_buy", true);
  assert.equal(eval2, true, "Disabled flag without disabledVariation falls back to flag defaultValue");

  const fullEval2 = await engine.evaluate("checkout.instant_buy", true);
  assert.equal(fullEval2.reason, "DISABLED");
  console.log("  ✓ Disabled flag properly marked with DISABLED reason");

  // 3. Multi-Variant String Flag
  console.log("\n3. Testing multi-variant string flag...");
  const searchEngineFlag: FeatureFlagDefinition<string> = {
    key: "search.algorithm",
    enabled: true,
    defaultValue: "lexical_bm25",
    defaultVariation: "bm25",
    variations: {
      bm25: "lexical_bm25",
      hybrid: "hybrid_dense_sparse",
      neural: "neural_rerank_v2",
    },
  };
  await engine.setFlag(searchEngineFlag);

  const searchVariant = await engine.getStringValue("search.algorithm", "fallback");
  assert.equal(searchVariant, "lexical_bm25", "Should return defaultVariation 'bm25' value");
  console.log("  ✓ Multi-variant string flag returned correct variant");

  // 4. Attribute Targeting Rules
  console.log("\n4. Testing attribute targeting rules...");
  const betaFeatureFlag: FeatureFlagDefinition<string> = {
    key: "ui.dashboard_theme",
    enabled: true,
    defaultValue: "classic",
    variations: {
      classic: "classic_blue",
      neon: "cyber_neon",
      vip: "gold_luxury",
    },
    defaultVariation: "classic",
    rules: [
      {
        id: "vip-tier-rule",
        attribute: "tier",
        operator: "equals",
        values: ["platinum", "gold"],
        variation: "vip",
      },
      {
        id: "admin-role-rule",
        attribute: "role",
        operator: "in",
        values: ["admin", "staff"],
        variation: "neon",
      },
    ],
  };
  await engine.setFlag(betaFeatureFlag);

  // Normal user -> classic
  const userEval = await engine.evaluate("ui.dashboard_theme", "classic", {
    targetingKey: "usr_100",
    attributes: { tier: "bronze", role: "customer" },
  });
  assert.equal(userEval.value, "classic_blue");
  assert.equal(userEval.reason, "STATIC");

  // VIP Platinum user -> vip
  const vipEval = await engine.evaluate("ui.dashboard_theme", "classic", {
    targetingKey: "usr_200",
    attributes: { tier: "platinum", role: "customer" },
  });
  assert.equal(vipEval.value, "gold_luxury");
  assert.equal(vipEval.variant, "vip");
  assert.equal(vipEval.reason, "TARGETING_MATCH");

  // Admin user -> neon
  const adminEval = await engine.evaluate("ui.dashboard_theme", "classic", {
    targetingKey: "usr_admin",
    attributes: { tier: "bronze", role: "admin" },
  });
  assert.equal(adminEval.value, "cyber_neon");
  assert.equal(adminEval.variant, "neon");
  assert.equal(adminEval.reason, "TARGETING_MATCH");
  console.log("  ✓ Attribute targeting rules evaluated correctly with priority ordering");

  // 5. Deterministic Canary Rollout
  console.log("\n5. Testing percentage-based canary rollout...");
  const rolloutFlag: FeatureFlagDefinition<boolean> = {
    key: "payment.v2_checkout_flow",
    enabled: true,
    defaultValue: false,
    rollout: {
      percentage: 25, // 25% rollout
      trueVariation: "v2",
      falseVariation: "v1",
    },
    variations: {
      v2: true,
      v1: false,
    },
  };
  await engine.setFlag(rolloutFlag);

  const contextA: EvaluationContext = { targetingKey: "user_alpha_9821" };
  const evalA1 = await engine.evaluate("payment.v2_checkout_flow", false, contextA);
  const evalA2 = await engine.evaluate("payment.v2_checkout_flow", false, contextA);

  assert.equal(evalA1.value, evalA2.value, "Canary evaluation must be strictly deterministic for identical targetingKey");
  assert.equal(evalA1.reason, "PERCENTAGE_ROLLOUT");

  // Run a larger distribution across 1000 simulated users to check uniform distribution ~25%
  let v2Count = 0;
  const sampleSize = 1000;
  for (let i = 0; i < sampleSize; i++) {
    const isV2 = await engine.getBooleanValue("payment.v2_checkout_flow", false, {
      targetingKey: `cust_${i}_seed`,
    });
    if (isV2) v2Count++;
  }
  const ratio = (v2Count / sampleSize) * 100;
  console.log(`  ✓ 25% Canary rollout produced ${v2Count}/${sampleSize} (${ratio.toFixed(1)}%) treatment allocation`);
  assert.ok(ratio >= 20 && ratio <= 30, `Canary distribution within expected statistical bounds (actual: ${ratio}%)`);

  // 6. Dynamic Rollout Percentage Update
  console.log("\n6. Testing dynamic rollout percentage update to 100%...");
  await engine.setRolloutPercentage("payment.v2_checkout_flow", 100);
  const fullRollout = await engine.getBooleanValue("payment.v2_checkout_flow", false, {
    targetingKey: "cust_any_user_now",
  });
  assert.equal(fullRollout, true, "100% rollout must evaluate to true for all users");
  console.log("  ✓ 100% rollout correctly applies to all users");

  // 7. Pub/Sub Invalidation Trigger
  console.log("\n7. Testing Pub/Sub invalidation message publishing...");
  assert.ok(mockRedis.publishLog.length >= 3, "Flag updates must publish invalidation events to Redis pub/sub channel");
  const lastMsg = JSON.parse(mockRedis.publishLog[mockRedis.publishLog.length - 1].message);
  assert.equal(lastMsg.flagKey, "payment.v2_checkout_flow");
  console.log("  ✓ Distributed pub/sub invalidation message verified");

  // 8. Flag Deletion and Listing
  console.log("\n8. Testing listing and deletion...");
  const flags = await engine.listFlags();
  assert.ok(flags.length >= 3, `Expected at least 3 flags, found ${flags.length}`);

  const deleted = await engine.deleteFlag("checkout.instant_buy");
  assert.equal(deleted, true);

  const afterDelete = await engine.getFlag("checkout.instant_buy");
  assert.equal(afterDelete, null, "Deleted flag must return null");
  console.log("  ✓ Flag deletion and listing verified");

  console.log("\n==================================================");
  console.log("🎉 All Feature Flagging Tests Passed Cleanly!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
