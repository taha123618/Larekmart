import { runUnitValidationTests } from "./unit/validation.test.js";
import { runStorageTests } from "./storage/storage.test.js";
import { runApiTests } from "./api/api.test.js";
import { runMessagingTests } from "./messaging/messaging.test.js";
import { runWorkerTests } from "./workers/workers.test.js";
import { runIntegrationSchemaTests } from "./integration/repository.test.js";

async function main(): Promise<void> {
  console.log("==========================================");
  console.log("   MEDIA SERVICE TEST SUITE RUNNER");
  console.log("==========================================\n");

  await runUnitValidationTests();
  await runStorageTests();
  await runApiTests();
  await runMessagingTests();
  await runWorkerTests();
  await runIntegrationSchemaTests();

  // Run the full media service end-to-end unit suite
  console.log("--- Running Full Media Service Lifecycle Suite ---");
  const { runFullMediaServiceTests } = await import("./media-service.test.js");
  await runFullMediaServiceTests();

  console.log("\n==========================================");
  console.log("   ALL MEDIA SERVICE TESTS PASSED!");
  console.log("==========================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
