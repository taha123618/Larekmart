import assert from "node:assert";
import {
  signPriceQuoteToken,
  verifyPriceQuoteToken,
  type SignedPriceQuotePayload,
} from "../src/index.js";

console.log("Running pricing quote token cryptographic tests...");

const mockPayload: SignedPriceQuotePayload = {
  quoteId: "quote_test_12345",
  currency: "USD",
  items: [
    {
      productId: 101,
      variantId: "var_blue",
      unitPricePaisa: 2500, // $25.00
      quantity: 2,
    },
    {
      productId: 102,
      variantId: null,
      unitPricePaisa: 1500, // $15.00
      quantity: 1,
    },
  ],
  subtotalPaisa: 6500,
  totalDiscountPaisa: 500,
  finalTotalPaisa: 6000,
  expiresAt: Date.now() + 15 * 60 * 1000, // +15 mins
  issuedAt: Date.now(),
};

// 1. Success case: Sign and Verify valid token
const token = signPriceQuoteToken(mockPayload);
assert(typeof token === "string", "Token should be a string");
assert(token.includes("."), "Token should contain signature separator '.'");

const verification = verifyPriceQuoteToken(token);
assert(verification.valid === true, "Verification should succeed for valid token");
if (verification.valid) {
  assert.strictEqual(verification.payload.quoteId, "quote_test_12345");
  assert.strictEqual(verification.payload.finalTotalPaisa, 6000);
  assert.strictEqual(verification.payload.items.length, 2);
  assert.strictEqual(verification.payload.items[0]?.unitPricePaisa, 2500);
}
console.log("  ✓ Valid quote token signs and verifies successfully in 0 DB hops");

// 2. Tamper resistance: Tampering with payload fails HMAC signature
const parts = token.split(".");
const payloadPart = parts[0]!;
const signaturePart = parts[1]!;
const tamperedPayloadStr = Buffer.from(payloadPart, "base64url").toString("utf8");
const tamperedObj = JSON.parse(tamperedPayloadStr);
tamperedObj.finalTotalPaisa = 100; // Attempt price tampering ($1 instead of $60)
const tamperedBase64Url = Buffer.from(JSON.stringify(tamperedObj)).toString("base64url");
const tamperedToken = `${tamperedBase64Url}.${signaturePart}`;

const tamperResult = verifyPriceQuoteToken(tamperedToken);
assert.strictEqual(tamperResult.valid, false);
assert.strictEqual((tamperResult as any).reason, "INVALID_SIGNATURE");
console.log("  ✓ Tampered payload is rejected with INVALID_SIGNATURE");

// 3. Expiration: Expired quote token is rejected
const expiredPayload: SignedPriceQuotePayload = {
  ...mockPayload,
  expiresAt: Date.now() - 5000, // expired 5 seconds ago
};
const expiredToken = signPriceQuoteToken(expiredPayload);
const expiredResult = verifyPriceQuoteToken(expiredToken);
assert.strictEqual(expiredResult.valid, false);
assert.strictEqual((expiredResult as any).reason, "EXPIRED");
console.log("  ✓ Expired quote token is rejected with EXPIRED");

// 4. Malformed format is rejected
const malformedResult = verifyPriceQuoteToken("not-a-valid-token");
assert.strictEqual(malformedResult.valid, false);
assert.strictEqual((malformedResult as any).reason, "INVALID_FORMAT");
console.log("  ✓ Malformed tokens are rejected with INVALID_FORMAT");

console.log("All pricing quote token cryptographic tests passed successfully!\n");
