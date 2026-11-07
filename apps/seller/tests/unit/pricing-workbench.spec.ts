import { describe, it, expect } from "vitest";

interface VolumeTier {
  minQty: number;
  maxQty?: number;
  discountPercent: number;
  tierName: string;
}

const defaultTiers: VolumeTier[] = [
  { minQty: 1, maxQty: 9, discountPercent: 0, tierName: "Standard Retail" },
  { minQty: 10, maxQty: 49, discountPercent: 5, tierName: "Volume Tier 1" },
  { minQty: 50, maxQty: 99, discountPercent: 10, tierName: "Bulk Tier 2" },
  { minQty: 100, discountPercent: 15, tierName: "Wholesale Partner" },
];

function resolveVolumeTier(qty: number, tiers = defaultTiers): VolumeTier {
  const match = tiers.find((t) => qty >= t.minQty && (t.maxQty === undefined || qty <= t.maxQty));
  return match || tiers[0]!;
}

function calculateTieredPriceQuote(params: {
  basePrice: number;
  quantity: number;
  currencyRate?: number;
  commissionRate?: number;
  tiers?: VolumeTier[];
}) {
  const { basePrice, quantity, currencyRate = 1.0, commissionRate = 0.12, tiers = defaultTiers } = params;
  const tier = resolveVolumeTier(quantity, tiers);
  const discountedUnitPrice = basePrice * (1 - tier.discountPercent / 100) * currencyRate;
  const grossTotal = discountedUnitPrice * quantity;
  const commission = grossTotal * commissionRate;
  const netTakeHome = grossTotal - commission;

  return {
    tierName: tier.tierName,
    discountPercent: tier.discountPercent,
    discountedUnitPrice: Math.round(discountedUnitPrice * 100) / 100,
    grossTotal: Math.round(grossTotal * 100) / 100,
    commission: Math.round(commission * 100) / 100,
    netTakeHome: Math.round(netTakeHome * 100) / 100,
  };
}

describe("Pricing Workbench & Tiered Quote Engine", () => {
  it("resolves the correct volume tier based on purchase quantity", () => {
    expect(resolveVolumeTier(1).tierName).toBe("Standard Retail");
    expect(resolveVolumeTier(9).discountPercent).toBe(0);
    expect(resolveVolumeTier(10).tierName).toBe("Volume Tier 1");
    expect(resolveVolumeTier(25).discountPercent).toBe(5);
    expect(resolveVolumeTier(50).tierName).toBe("Bulk Tier 2");
    expect(resolveVolumeTier(75).discountPercent).toBe(10);
    expect(resolveVolumeTier(100).tierName).toBe("Wholesale Partner");
    expect(resolveVolumeTier(500).discountPercent).toBe(15);
  });

  it("calculates accurate discounted unit price and net take-home for wholesale volume", () => {
    // 100 units at $50 base price with 15% wholesale discount
    const quote = calculateTieredPriceQuote({
      basePrice: 50,
      quantity: 100,
      commissionRate: 0.12,
    });

    // Discounted unit = 50 * 0.85 = $42.50
    expect(quote.discountedUnitPrice).toBe(42.5);
    // Gross Total = 42.50 * 100 = $4,250.00
    expect(quote.grossTotal).toBe(4250);
    // 12% commission = 4250 * 0.12 = $510.00
    expect(quote.commission).toBe(510);
    // Net take-home = 4250 - 510 = $3,740.00
    expect(quote.netTakeHome).toBe(3740);
  });

  it("converts quotes accurately across foreign exchange rates", () => {
    // 10 units at $100 base price, 5% tier discount, converted to PKR (rate = 278.5)
    const quote = calculateTieredPriceQuote({
      basePrice: 100,
      quantity: 10,
      currencyRate: 278.5,
      commissionRate: 0.12,
    });

    // Unit in USD = 100 * 0.95 = 95 USD
    // Unit in PKR = 95 * 278.5 = 26,457.50 PKR
    expect(quote.discountedUnitPrice).toBe(26457.5);
    // Gross total in PKR = 264,575.00 PKR
    expect(quote.grossTotal).toBe(264575);
    // Net take-home (88%) = 264,575 * 0.88 = 232,826.00 PKR
    expect(quote.netTakeHome).toBe(232826);
  });
});
