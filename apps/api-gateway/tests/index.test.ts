import { runRouteRegistryTests } from "./unit/route-registry.test.js";
import { runCircuitBreakerTests } from "./unit/circuit-breaker.test.js";
import { runCircuitBreakerDynamicTests } from "./unit/circuit-breaker-dynamic.test.js";
import { runSlidingWindowMetricsTests } from "./unit/sliding-window-metrics.test.js";
import { runRetryTests } from "./unit/retry.test.js";
import { runSingleFlightTests } from "./unit/singleflight.test.js";
import { runAuthTests } from "./auth/auth.test.js";
import { runSecurityTests } from "./security/security.test.js";
import { runHealthIntegrationTests } from "./integration/health.test.js";
import { runInventoryEdgeTests } from "./integration/inventory-edge.test.js";
import { runChaosGuardrailsTests } from "./resilience/chaos-guardrails.test.js";

async function main() {
  console.log("=================================================");
  console.log("🚀 Larekmart API Gateway Test Suite Execution");
  console.log("=================================================\n");

  const start = Date.now();

  try {
    await runRouteRegistryTests();
    await runCircuitBreakerTests();
    await runCircuitBreakerDynamicTests();
    await runSlidingWindowMetricsTests();
    await runRetryTests();
    await runSingleFlightTests();
    await runAuthTests();
    await runSecurityTests();
    await runHealthIntegrationTests();
    await runInventoryEdgeTests();
    await runChaosGuardrailsTests();

    const elapsed = Date.now() - start;
    console.log("\n=================================================");
    console.log(`✅ All API Gateway test suites passed in ${elapsed}ms!`);
    console.log("=================================================");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ API Gateway test suite failure:", error);
    process.exit(1);
  }
}

main();
