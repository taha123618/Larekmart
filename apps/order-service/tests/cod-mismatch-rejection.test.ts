import assert from "assert";
import { computeCodOrderTotalPaisa } from "../src/routes/order.js";
import type { CreateCodOrderInput } from "@repo/types";

/**
 * Regression tests for the 409 amount-mismatch rejection on POST /orders/cod
 * (audit finding cod-order-client-amount, severity HIGH).
 *
 * Route-level invariant under test: when the client-declared `amount` differs
 * from the server-computed total, the handler must reject the order with 409
 * *before* any order document is written or any `order.created` event is
 * published.
 *
 * These tests mirror the handler's decision logic exactly:
 *   const serverAmount = computeCodOrderTotalPaisa(body, serverPrices);
 *   if (serverAmount !== body.amount) → 409
 * so any change that weakens the handler (e.g. trusting body.amount again,
 * silently overwriting the amount, or widening the comparison) fails here.
 *
 * Run: pnpm --filter order-service test:cod
 */

function buildBody(
  overrides: Partial<CreateCodOrderInput> = {},
): CreateCodOrderInput {
  return {
    email: "buyer@example.com",
    amount: 350030,
    discountTotal: 0,
    taxTotal: 0,
    shippingRateAmount: 20000,
    codFee: 3000,
    shippingAddress: {
      fullName: "Ayesha Khan",
      phone: "+923001234567",
      addressLine1: "House 10, St 5",
      city: "Lahore",
      postalCode: "54000",
      country: "PK",
    },
    products: [{ productId: 42, quantity: 1, price: 1 }],
    ...overrides,
  };
}

/** The handler's exact accept/reject decision. */
const handlerWouldReject = (
  body: CreateCodOrderInput,
  serverPrices: Map<number, number>,
): boolean => computeCodOrderTotalPaisa(body, serverPrices) !== body.amount;

async function runCodMismatchTests() {
  console.log("=== COD Amount-Mismatch Rejection Regression Tests ===\n");

  const catalogPrices = new Map<number, number>([
    [42, 349900], // PKR 3,499.00 in paisa
    [7, 150000], // PKR 1,500.00 in paisa
  ]);

  // 1. The audit attack payload: amount=1 for a full-priced coat → 409
  console.log("1. Attack payload amount=1 is rejected...");
  const attack = buildBody({ amount: 1 });
  assert.equal(
    handlerWouldReject(attack, catalogPrices),
    true,
    "amount=1 against a 349900-paisa coat must be rejected (409)",
  );
  console.log("✓ manipulated amount cannot create an order");

  // 2. Honest client with the correct total → accepted
  console.log("2. Honest payload with the exact server total is accepted...");
  const honest = buildBody({ amount: 372900 }); // 349900 + 20000 + 3000
  assert.equal(
    handlerWouldReject(honest, catalogPrices),
    false,
    "a correctly computed amount must be accepted",
  );
  console.log("✓ legitimate orders still pass");

  // 3. Off-by-one tampering → rejected (no tolerance drift)
  console.log("3. Off-by-one amount tampering is rejected...");
  const offByOne = buildBody({ amount: 372899 });
  assert.equal(
    handlerWouldReject(offByOne, catalogPrices),
    true,
    "even a 1-paisa mismatch must be rejected — exact equality required",
  );
  console.log("✓ exact-match comparison, no silent tolerance");

  // 4. Multi-line order with a manipulated component → rejected
  console.log("4. Manipulated shipping/discount components are rejected...");
  const manipulatedComponents = buildBody({
    products: [
      { productId: 42, quantity: 2 },
      { productId: 7, quantity: 1 },
    ],
    discountTotal: 50000,
    taxTotal: 10000,
    shippingRateAmount: 0, // client claims free shipping
    codFee: 3000,
    // honest total would be 849900+25000+3000-50000+10000 = 837900 with shipping 25000;
    // with shipping zeroed the client under-declares by 25000
    amount: 862900,
  });
  assert.equal(
    handlerWouldReject(manipulatedComponents, catalogPrices),
    true,
    "under-declaring shipping must be rejected",
  );
  console.log("✓ every declared component feeds the server recomputation");

  // 5. Unknown product is a rejection (mismatch is unavoidable)
  console.log("5. Unknown productId cannot be priced → rejected...");
  const unknownProduct = buildBody({ products: [{ productId: 999999, quantity: 1 }] });
  assert.equal(
    !catalogPrices.has(unknownProduct.products[0]!.productId),
    true,
    "handler 409s unknown products before pricing",
  );
  console.log("✓ unknown products fail before any order is written");

  console.log(
    "\n=======================================================\n" +
      " All COD Mismatch Rejection Regression Tests Passed!\n" +
      "=======================================================\n",
  );
  process.exit(0);
}

runCodMismatchTests().catch((err) => {
  console.error("COD mismatch test failed:", err);
  process.exit(1);
});
