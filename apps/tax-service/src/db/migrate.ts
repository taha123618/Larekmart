import { getPool } from "./connection.js";

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    console.log("Running tax-service MySQL database migrations...");

    // 1. tax_jurisdictions
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_jurisdictions (
        id VARCHAR(36) PRIMARY KEY,
        country_code VARCHAR(3) NOT NULL,
        region_code VARCHAR(20) NULL,
        municipality VARCHAR(100) NULL,
        jurisdiction_code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. tax_categories
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_categories (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. tax_rules
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_rules (
        id VARCHAR(36) PRIMARY KEY,
        jurisdiction_id VARCHAR(36) NOT NULL,
        category_id VARCHAR(36) NOT NULL,
        rate DECIMAL(10, 6) NOT NULL,
        is_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
        priority INT NOT NULL DEFAULT 1,
        effective_from TIMESTAMP NOT NULL,
        effective_to TIMESTAMP NULL,
        version VARCHAR(50) NOT NULL DEFAULT '2026-10',
        calculation_method VARCHAR(20) NOT NULL DEFAULT 'percentage',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (jurisdiction_id) REFERENCES tax_jurisdictions(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES tax_categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. tax_exemptions
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_exemptions (
        id VARCHAR(36) PRIMARY KEY,
        customer_id VARCHAR(100) NULL,
        exemption_certificate VARCHAR(100) NOT NULL,
        exemption_type VARCHAR(50) NOT NULL,
        jurisdiction_id VARCHAR(36) NULL,
        valid_from TIMESTAMP NOT NULL,
        valid_to TIMESTAMP NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (jurisdiction_id) REFERENCES tax_jurisdictions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. tax_calculations
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_calculations (
        id VARCHAR(64) PRIMARY KEY,
        reference_type VARCHAR(20) NOT NULL DEFAULT 'quote',
        reference_id VARCHAR(100) NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        subtotal DECIMAL(12, 4) NOT NULL,
        tax_total DECIMAL(12, 4) NOT NULL,
        total DECIMAL(12, 4) NOT NULL,
        rule_version VARCHAR(50) NOT NULL,
        provider VARCHAR(50) NOT NULL DEFAULT 'standard',
        input_snapshot TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. tax_calculation_lines
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_calculation_lines (
        id VARCHAR(64) PRIMARY KEY,
        calculation_id VARCHAR(64) NOT NULL,
        line_id VARCHAR(100) NOT NULL,
        product_id VARCHAR(100) NULL,
        category_id VARCHAR(36) NULL,
        taxable_amount DECIMAL(12, 4) NOT NULL,
        rate DECIMAL(10, 6) NOT NULL,
        tax_amount DECIMAL(12, 4) NOT NULL,
        jurisdiction_code VARCHAR(50) NOT NULL,
        is_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
        breakdown TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (calculation_id) REFERENCES tax_calculations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. tax_provider_logs
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_provider_logs (
        id VARCHAR(36) PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        request_payload TEXT NOT NULL,
        response_payload TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'success',
        latency_ms INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log(
      "tax-service MySQL database migrations completed successfully.",
    );
  } catch (error) {
    console.error("Failed to run migrations in tax-service:", error);
    throw error;
  } finally {
    conn.release();
  }
}

if (
  process.argv[1]?.endsWith("migrate.ts") ||
  process.argv[1]?.endsWith("migrate.js")
) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
