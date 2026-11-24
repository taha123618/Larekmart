import { runDastSecurityTests } from "./dast.test.js";

async function main() {
  try {
    await runDastSecurityTests();
    process.exit(0);
  } catch (err) {
    console.error("❌ DAST Security Test Failure:", err);
    process.exit(1);
  }
}

main();
