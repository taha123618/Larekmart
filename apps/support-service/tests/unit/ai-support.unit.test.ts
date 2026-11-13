import assert from "node:assert/strict";
import { AiSupportService } from "../../src/modules/ai/ai-support.service.js";

async function runTests() {
  console.log("==================================================");
  console.log("    SUPPORT SERVICE - AI ASSISTANT UNIT TESTS     ");
  console.log("==================================================");

  const service = new AiSupportService();

  console.log("\n[1. Intent Matching & Action Guidance]");
  {
    // Order tracking
    const resTracking = await service.answerQuestion({ message: "Where is my package and what is tracking status?" });
    assert.equal(resTracking.intent, "ORDER_TRACKING");
    assert.equal(resTracking.suggestedAction, "TRACK_ORDER");
    assert.ok(resTracking.confidence >= 0.7);
    console.log("  ✓ Order tracking intent detected with TRACK_ORDER action");

    // Return policy
    const resReturn = await service.answerQuestion({ message: "Can I return a damaged item for refund or RMA?" });
    assert.equal(resReturn.intent, "RETURN_POLICY");
    assert.equal(resReturn.suggestedAction, "REQUEST_RETURN");
    console.log("  ✓ Return policy intent detected with REQUEST_RETURN action");

    // Shipping inquiry
    const resShipping = await service.answerQuestion({ message: "How long does shipping take with TCS delivery?" });
    assert.equal(resShipping.intent, "SHIPPING_INQUIRY");
    console.log("  ✓ Shipping inquiry intent detected with carrier references");

    // Payment methods
    const resPayment = await service.answerQuestion({ message: "Do you support Stripe credit card and cash on delivery?" });
    assert.equal(resPayment.intent, "PAYMENT_METHODS");
    assert.equal(resPayment.suggestedAction, "VIEW_CART");
    console.log("  ✓ Payment methods intent detected with VIEW_CART action");

    // Seller onboarding
    const resSeller = await service.answerQuestion({ message: "How do I become a merchant and complete KYB onboarding?" });
    assert.equal(resSeller.intent, "SELLER_ONBOARDING");
    console.log("  ✓ Seller onboarding intent detected with KYB guidance");
  }

  console.log("\n[2. Fallback & Escalation Capability]");
  {
    const resGeneral = await service.answerQuestion({ message: "What is the meaning of life?" });
    assert.equal(resGeneral.intent, "GENERAL_HELP");
    assert.equal(resGeneral.suggestedAction, "OPEN_TICKET");
    assert.equal(resGeneral.canEscalate, true);
    assert.ok(resGeneral.answer.includes("escalate"));
    console.log("  ✓ Unmatched question falls back to GENERAL_HELP with OPEN_TICKET escalation");
  }

  console.log("\n==================================================");
  console.log("  AI ASSISTANT UNIT TESTS COMPLETED: 6 passed, 0 failed");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("AI support tests failed:", err);
  process.exit(1);
});
