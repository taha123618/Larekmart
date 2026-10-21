import { db, pool } from "./connection.js";
import {
  priceLists,
  currencyRates,
  productPrices,
  priceRules,
} from "./schema.js";
import { sql } from "drizzle-orm";

export async function runSeed(): Promise<void> {
  console.log("Seeding pricing-service database with initial data...");

  // 1. Seed Currency Exchange Rates
  const defaultRates = [
    { baseCurrency: "USD", targetCurrency: "USD", exchangeRate: "1.000000" },
    { baseCurrency: "USD", targetCurrency: "EUR", exchangeRate: "0.920000" },
    { baseCurrency: "USD", targetCurrency: "GBP", exchangeRate: "0.780000" },
    { baseCurrency: "USD", targetCurrency: "CAD", exchangeRate: "1.360000" },
    { baseCurrency: "USD", targetCurrency: "PKR", exchangeRate: "278.500000" },
  ];

  for (const rate of defaultRates) {
    await db
      .insert(currencyRates)
      .values(rate)
      .onConflictDoUpdate({
        target: [currencyRates.baseCurrency, currencyRates.targetCurrency],
        set: { exchangeRate: rate.exchangeRate, updatedAt: sql`NOW()` },
      });
  }

  // 2. Seed Default B2C & B2B Price Lists
  const [b2cList] = await db
    .insert(priceLists)
    .values({
      name: "Default Retail Price List",
      code: "DEFAULT_B2C",
      currency: "USD",
      isDefault: true,
      type: "b2c",
    })
    .onConflictDoNothing()
    .returning();

  const [b2bList] = await db
    .insert(priceLists)
    .values({
      name: "Wholesale Partner B2B Price List",
      code: "WHOLESALE_B2B",
      currency: "USD",
      isDefault: false,
      type: "b2b",
    })
    .onConflictDoNothing()
    .returning();

  // 3. Seed Sample Product Prices if B2C list exists
  const activeListId = b2cList?.id;
  if (activeListId) {
    const samplePrices = [
      {
        priceListId: activeListId,
        productId: "prod_sample_1",
        basePrice: "99.9900",
        minPrice: "79.9900",
        maxPrice: "129.9900",
        compareAtPrice: "119.9900",
        costPrice: "50.0000",
      },
      {
        priceListId: activeListId,
        productId: "prod_sample_2",
        basePrice: "49.5000",
        minPrice: "35.0000",
        maxPrice: "60.0000",
        compareAtPrice: "59.9900",
        costPrice: "22.0000",
      },
    ];

    for (const sp of samplePrices) {
      await db.insert(productPrices).values(sp).onConflictDoNothing();
    }
  }

  console.log("pricing-service database seeding completed successfully.");
}

if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js")
) {
  runSeed()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
