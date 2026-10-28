import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import {
  convertCurrency,
  applyPsychologicalRounding,
} from "../src/engine/currency.js";
import { Decimal } from "decimal.js";
import {
  SupportedCurrencySchema,
  PsychologicalRoundingRuleSchema,
  RefreshCurrencyRatesResponseSchema,
  DEFAULT_INTERNAL_SECRET,
} from "@repo/types";

async function runCurrencyConversionTests() {
  console.log("==================================================");
  console.log("   DYNAMIC FX & PSYCHOLOGICAL ROUNDING TEST SUITE ");
  console.log("==================================================\n");

  // ────────────────────────────────────────────────────────────
  // Test 1: High-Precision Decimal.js Floating Currency Conversion
  // ────────────────────────────────────────────────────────────
  console.log("[Test 1] Floating Currency Conversion Math");

  // 1.1 Identity conversion (USD -> USD)
  const usdToUsd = convertCurrency(100, 1.0, "USD", "USD");
  assert.equal(usdToUsd.convertedAmount, 100);
  assert.equal(usdToUsd.exchangeRate, 1.0);
  assert.equal(usdToUsd.isPsychologicallyRounded, false);
  console.log("  ✓ Identity conversion (USD -> USD) preserves exact amount");

  // 1.2 USD to EUR at rate 0.92
  const usdToEur = convertCurrency(100, 0.92, "USD", "EUR");
  assert.equal(usdToEur.convertedAmount, 92);
  assert.equal(usdToEur.targetCurrency, "EUR");
  console.log("  ✓ USD -> EUR floating conversion accurate");

  // 1.3 USD to PKR at rate 278.50
  const usdToPkr = convertCurrency(20, 278.5, "USD", "PKR");
  assert.equal(usdToPkr.convertedAmount, 5570);
  assert.equal(usdToPkr.targetCurrency, "PKR");
  console.log("  ✓ USD -> PKR conversion calculated without precision drift");

  // 1.4 Strict validation on negative or zero rate
  assert.throws(
    () => convertCurrency(100, 0, "USD", "EUR"),
    /Exchange rate must be strictly positive/,
  );
  assert.throws(
    () => convertCurrency(-50, 1.2, "USD", "EUR"),
    /Amount for currency conversion must be non-negative/,
  );
  console.log("  ✓ Rejection of negative amounts and invalid non-positive rates");

  // ────────────────────────────────────────────────────────────
  // Test 2: Regional Psychological Charm Pricing Rules
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Regional Psychological Pricing Rules");

  // 2.1 Western Charm Pricing (USD/EUR/GBP/CAD -> .99)
  const rawUsd = new Decimal(24.32);
  const charmUsd = applyPsychologicalRounding(rawUsd, "USD");
  assert.equal(charmUsd.toNumber(), 24.99);

  const rawEur = new Decimal(89.45);
  const charmEur = applyPsychologicalRounding(rawEur, "EUR");
  assert.equal(charmEur.toNumber(), 89.99);

  const rawGbp = new Decimal(14.1);
  const charmGbp = applyPsychologicalRounding(rawGbp, "GBP");
  assert.equal(charmGbp.toNumber(), 14.99);
  console.log("  ✓ USD, EUR, and GBP prices charm-rounded to .99");

  // 2.2 Pakistani Rupee (PKR -> nearest 50 for realistic retail)
  const rawPkr1 = new Decimal(5482);
  const roundedPkr1 = applyPsychologicalRounding(rawPkr1, "PKR");
  assert.equal(roundedPkr1.toNumber(), 5500);

  const rawPkr2 = new Decimal(5460);
  const roundedPkr2 = applyPsychologicalRounding(rawPkr2, "PKR");
  assert.equal(roundedPkr2.toNumber(), 5450);
  console.log("  ✓ PKR prices rounded to nearest 50 unit intervals");

  // 2.3 Middle Eastern Rails (AED & SAR -> .00 or .50)
  const rawAed = new Decimal(73.34);
  const roundedAed = applyPsychologicalRounding(rawAed, "AED");
  assert.equal(roundedAed.toNumber(), 73.5);

  const rawSar = new Decimal(99.12);
  const roundedSar = applyPsychologicalRounding(rawSar, "SAR");
  assert.equal(roundedSar.toNumber(), 99.0);
  console.log("  ✓ AED and SAR rounded to clean half-units (.50/.00)");

  // 2.4 Low-value item protection (< 1.00 preserves decimals)
  const microItem = new Decimal(0.45);
  const protectedMicro = applyPsychologicalRounding(microItem, "USD");
  assert.equal(protectedMicro.toNumber(), 0.45);
  console.log("  ✓ Low-value micro items (< 1.00) protected from upward rounding");

  // 2.5 Integrated convertCurrency with psychological option
  const charmConverted = convertCurrency(10, 0.92, "USD", "EUR", {
    applyPsychologicalRounding: true,
  });
  assert.equal(charmConverted.convertedAmount, 9.99);
  assert.equal(charmConverted.isPsychologicallyRounded, true);
  console.log("  ✓ convertCurrency applies psychological rounding seamlessly");

  // ────────────────────────────────────────────────────────────
  // Test 3: Zod Schema Contracts Verification
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 3] Zod Schema Domain Contracts");

  const validCurrencies = ["USD", "PKR", "EUR", "GBP", "AED", "SAR"];
  for (const c of validCurrencies) {
    assert.equal(SupportedCurrencySchema.parse(c), c);
  }
  assert.throws(() => SupportedCurrencySchema.parse("XYZ"));
  console.log("  ✓ SupportedCurrencySchema validates supported currencies");

  const validRules = ["none", "point_99", "point_95", "nearest_ten", "nearest_hundred"];
  for (const r of validRules) {
    assert.equal(PsychologicalRoundingRuleSchema.parse(r), r);
  }
  console.log("  ✓ PsychologicalRoundingRuleSchema validates all rounding strategies");

  const parsedRefresh = RefreshCurrencyRatesResponseSchema.parse({
    success: true,
    refreshedCount: 5,
    source: "central-bank-fx-feed",
    rates: {
      EUR: 0.92,
      GBP: 0.79,
      PKR: 278.5,
      AED: 3.67,
      SAR: 3.75,
    },
    refreshedAt: new Date().toISOString(),
  });
  assert.equal(parsedRefresh.refreshedCount, 5);
  console.log("  ✓ RefreshCurrencyRatesResponseSchema validated against payload");

  // ────────────────────────────────────────────────────────────
  // Test 4: Fastify Endpoints & Route Security
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 4] Fastify HTTP Endpoints & Security Probes");

  const app = await buildApp();

  try {
    // 4.1 Public currencies endpoint
    const currenciesRes = await app.inject({
      method: "GET",
      url: "/api/v1/prices/currencies",
    });
    assert.equal(currenciesRes.statusCode, 200);
    const currenciesJson = JSON.parse(currenciesRes.payload);
    assert.ok(Array.isArray(currenciesJson.rates));
    assert.ok(currenciesJson.rates.length > 0);
    console.log("  ✓ GET /api/v1/prices/currencies returns active exchange rates");

    // 4.2 Admin refresh endpoint rejects unauthenticated request
    const unauthRefreshRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/prices/currencies/refresh",
    });
    assert.equal(unauthRefreshRes.statusCode, 401);
    console.log("  ✓ POST /api/v1/admin/prices/currencies/refresh rejects unauthenticated request (401)");

    // 4.3 Admin refresh endpoint succeeds with internal secret
    const authRefreshRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/prices/currencies/refresh",
      headers: {
        "x-internal-secret": DEFAULT_INTERNAL_SECRET,
      },
    });
    assert.equal(authRefreshRes.statusCode, 200);
    const refreshJson = JSON.parse(authRefreshRes.payload);
    assert.equal(refreshJson.success, true);
    assert.ok(refreshJson.refreshedCount >= 5);
    assert.ok(refreshJson.rates.PKR > 0);
    console.log("  ✓ POST /api/v1/admin/prices/currencies/refresh succeeds with internal secret");

    console.log("\n==================================================");
    console.log("  ALL CURRENCY CONVERSION TESTS PASSED (100%)!    ");
    console.log("==================================================\n");
  } finally {
    await app.close();
  }
}

runCurrencyConversionTests()
  .then(async () => {
    const { redis } = await import("../src/utils/redis.js");
    await redis.close().catch(() => {});
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });

