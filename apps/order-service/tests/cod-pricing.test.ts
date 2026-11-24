import assert from "assert";
import { computeCodOrderTotalPaisa } from "../src/routes/order.js";
import {
  type CreateCodOrderInput,
  signPriceQuoteToken,
  verifyPriceQuoteToken,
  type SignedPriceQuotePayload,
} from "@repo/types";

/**
 * Regression tests for the server-authoritative COD pricing fix
 * (audit finding cod-order-client-amount, severity HIGH).
 *
 * The invariant under test: the persisted order total is always derived from
 * server-side catalog prices, never from the client-declared amount.
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

async function runCodPricingTests() {
  console.log("=== COD Server-Side Pricing Regression Tests ===\n");

  const catalogPrices = new Map<number, number>([
    [42, 349900], // PKR 3,499.00 in paisa
    [7, 150000], // PKR 1,500.00 in paisa
  ]);

  // 1. Server total is derived from catalog prices, ignoring client price
  console.log("1. Total is computed from server prices...");
  const serverTotal = computeCodOrderTotalPaisa(buildBody(), catalogPrices);
  assert.equal(
    serverTotal,
    349900 + 20000 + 3000,
    "Total must equal server-priced items + shipping + COD fee",
  );
  console.log("✓ Client-declared price fields are ignored for pricing");

  // 2. The attack payload: client declares amount=1 paisa for a full cart
  console.log("2. Attack payload produces a mismatched server total...");
  const attack = computeCodOrderTotalPaisa(
    buildBody({ amount: 1 }),
    catalogPrices,
  );
  assert.notEqual(
    attack,
    1,
    "Server total must never equal the manipulated client amount",
  );
  assert.equal(attack, 372900, "Server total stays authoritative");
  console.log("✓ amount:1 payload cannot produce a 1-paisa order");

  // 3. Components: items + shipping + codFee - discount + tax
  console.log("3. Total arithmetic includes every declared component...");
  const withComponents = computeCodOrderTotalPaisa(
    buildBody({
      products: [
        { productId: 42, quantity: 2 },
        { productId: 7, quantity: 1 },
      ],
      discountTotal: 50000,
      taxTotal: 10000,
      shippingRateAmount: 25000,
      codFee: 3000,
    }),
    catalogPrices,
  );
  assert.equal(
    withComponents,
    2 * 349900 + 150000 + 25000 + 3000 - 50000 + 10000,
    "Total must be items + shipping + codFee - discount + tax",
  );
  console.log("✓ discount and tax components honored in the recomputation");

  // 4. Total never goes negative
  console.log("4. Total floors at zero...");
  const floored = computeCodOrderTotalPaisa(
    buildBody({ discountTotal: 10_000_000 }),
    catalogPrices,
  );
  assert.equal(floored, 0, "Total must not be negative");
  console.log("✓ floor-at-zero holds");

  // 5. Zero-DB Cryptographic Signed Quote Fast Path
  console.log("5. Signed pricing quote token resolves authoritative prices with 0 DB hops...");
  const signedPayload: SignedPriceQuotePayload = {
    quoteId: "quote_cod_flash_999",
    currency: "PKR",
    items: [
      { productId: 42, unitPricePaisa: 349900, quantity: 1 },
      { productId: 7, unitPricePaisa: 150000, quantity: 2 },
    ],
    subtotalPaisa: 649900,
    totalDiscountPaisa: 0,
    finalTotalPaisa: 649900,
    expiresAt: Date.now() + 15 * 60 * 1000,
    issuedAt: Date.now(),
  };

  const token = signPriceQuoteToken(signedPayload);
  const verifyRes = verifyPriceQuoteToken(token);
  assert.equal(verifyRes.valid, true, "Valid signed token must verify");
  if (verifyRes.valid) {
    const verifiedPrices = new Map<number, number>();
    for (const item of verifyRes.payload.items) {
      verifiedPrices.set(item.productId, item.unitPricePaisa);
    }
    const computedTotal = computeCodOrderTotalPaisa(
      buildBody({
        products: [
          { productId: 42, quantity: 1 },
          { productId: 7, quantity: 2 },
        ],
        shippingRateAmount: 20000,
        codFee: 3000,
      }),
      verifiedPrices,
    );
    assert.equal(
      computedTotal,
      349900 + 2 * 150000 + 20000 + 3000,
      "Order total verified from signed quote without querying PostgreSQL",
    );
    console.log("✓ Signed quote token prices verified authoritatively with 0 DB queries");
  }

  // 6. Expired token rejection
  console.log("6. Expired quote tokens are rejected...");
  const expiredToken = signPriceQuoteToken({
    ...signedPayload,
    expiresAt: Date.now() - 1000,
  });
  const expiredCheck = verifyPriceQuoteToken(expiredToken);
  assert.equal(expiredCheck.valid, false);
  assert.equal((expiredCheck as any).reason, "EXPIRED");
  console.log("✓ Expired token rejected with EXPIRED");

  console.log(
    "\n=======================================================\n" +
      " All COD Pricing Regression Tests Passed Successfully!\n" +
      "=======================================================\n",
  );
  process.exit(0);
}

runCodPricingTests().catch((err) => {
  console.error("COD pricing test failed:", err);
  process.exit(1);
});
