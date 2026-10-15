import { v4 as uuidv4 } from "uuid";
import { getPool } from "./connection.js";

export async function runSeed(): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    console.log(
      "Seeding tax-service standard jurisdictions, categories, and rules...",
    );

    // 1. Seed Categories
    const categories = [
      {
        id: "cat_standard",
        code: "standard",
        name: "Standard Merchandise",
        description: "General taxable retail items",
      },
      {
        id: "cat_clothing",
        code: "clothing",
        name: "Apparel & Clothing",
        description: "Clothing and footwear",
      },
      {
        id: "cat_groceries",
        code: "groceries",
        name: "Food & Groceries",
        description: "Essential food and non-prepared groceries",
      },
      {
        id: "cat_digital",
        code: "digital_goods",
        name: "Digital Products",
        description: "Software downloads and digital media",
      },
      {
        id: "cat_exempt",
        code: "exempt",
        name: "Exempt Merchandise",
        description: "Legally non-taxable products",
      },
    ];

    for (const cat of categories) {
      await conn.query(
        `INSERT IGNORE INTO tax_categories (id, code, name, description, is_active) VALUES (?, ?, ?, ?, TRUE);`,
        [cat.id, cat.code, cat.name, cat.description],
      );
    }

    // 2. Seed Jurisdictions
    const jurisdictions = [
      {
        id: "jur_us_fed",
        countryCode: "US",
        regionCode: null,
        municipality: null,
        jurisdictionCode: "US",
        name: "United States Federal",
      },
      {
        id: "jur_us_ca",
        countryCode: "US",
        regionCode: "CA",
        municipality: null,
        jurisdictionCode: "US-CA",
        name: "California State",
      },
      {
        id: "jur_us_ca_la",
        countryCode: "US",
        regionCode: "CA",
        municipality: "Los Angeles",
        jurisdictionCode: "US-CA-LA",
        name: "Los Angeles County / City",
      },
      {
        id: "jur_us_ny",
        countryCode: "US",
        regionCode: "NY",
        municipality: null,
        jurisdictionCode: "US-NY",
        name: "New York State",
      },
      {
        id: "jur_gb",
        countryCode: "GB",
        regionCode: null,
        municipality: null,
        jurisdictionCode: "GB",
        name: "United Kingdom HMRC",
      },
    ];

    for (const jur of jurisdictions) {
      await conn.query(
        `INSERT IGNORE INTO tax_jurisdictions (id, country_code, region_code, municipality, jurisdiction_code, name, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE);`,
        [
          jur.id,
          jur.countryCode,
          jur.regionCode,
          jur.municipality,
          jur.jurisdictionCode,
          jur.name,
        ],
      );
    }

    // 3. Seed Tax Rules
    const effectiveFrom = new Date("2026-01-01T00:00:00Z");
    const rules = [
      // California State: 6.00%
      {
        id: "rule_ca_std",
        jurisdictionId: "jur_us_ca",
        categoryId: "cat_standard",
        rate: "0.060000",
        isInclusive: false,
        priority: 1,
        version: "2026-10",
      },
      // Los Angeles: 2.25%
      {
        id: "rule_ca_la_std",
        jurisdictionId: "jur_us_ca_la",
        categoryId: "cat_standard",
        rate: "0.022500",
        isInclusive: false,
        priority: 2,
        version: "2026-10",
      },
      // California Groceries: 0.00%
      {
        id: "rule_ca_groc",
        jurisdictionId: "jur_us_ca",
        categoryId: "cat_groceries",
        rate: "0.000000",
        isInclusive: false,
        priority: 1,
        version: "2026-10",
      },
      // New York State: 4.00%
      {
        id: "rule_ny_std",
        jurisdictionId: "jur_us_ny",
        categoryId: "cat_standard",
        rate: "0.040000",
        isInclusive: false,
        priority: 1,
        version: "2026-10",
      },
      // UK VAT: 20.00% inclusive
      {
        id: "rule_gb_vat",
        jurisdictionId: "jur_gb",
        categoryId: "cat_standard",
        rate: "0.200000",
        isInclusive: true,
        priority: 1,
        version: "2026-10",
      },
    ];

    for (const r of rules) {
      await conn.query(
        `INSERT IGNORE INTO tax_rules (id, jurisdiction_id, category_id, rate, is_inclusive, priority, effective_from, version, calculation_method, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'percentage', TRUE);`,
        [
          r.id,
          r.jurisdictionId,
          r.categoryId,
          r.rate,
          r.isInclusive,
          r.priority,
          effectiveFrom,
          r.version,
        ],
      );
    }

    // 4. Seed Exemption Example
    await conn.query(
      `INSERT IGNORE INTO tax_exemptions (id, customer_id, exemption_certificate, exemption_type, jurisdiction_id, valid_from, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE);`,
      [
        "ex_wholesale_123",
        "cust_wholesale_01",
        "CERT-WHOLESALE-2026",
        "wholesale",
        "jur_us_ca",
        effectiveFrom,
      ],
    );

    console.log("tax-service seed data inserted successfully.");
  } catch (error) {
    console.error("Failed to seed tax-service data:", error);
    throw error;
  } finally {
    conn.release();
  }
}

if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js")
) {
  runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
