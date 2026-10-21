import { pool } from "./connection.js";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("Running pricing-service database migrations...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS price_lists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(64) NOT NULL UNIQUE,
        currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
        is_default BOOLEAN DEFAULT FALSE NOT NULL,
        type VARCHAR(16) DEFAULT 'b2c' NOT NULL,
        seller_id VARCHAR(64),
        valid_from TIMESTAMPTZ,
        valid_to TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS price_lists_code_idx ON price_lists(code);
      CREATE INDEX IF NOT EXISTS price_lists_type_idx ON price_lists(type);
      CREATE INDEX IF NOT EXISTS price_lists_is_default_idx ON price_lists(is_default);
      CREATE INDEX IF NOT EXISTS price_lists_seller_idx ON price_lists(seller_id);

      CREATE TABLE IF NOT EXISTS product_prices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
        product_id VARCHAR(64) NOT NULL,
        base_price NUMERIC(12, 4) NOT NULL,
        min_price NUMERIC(12, 4),
        max_price NUMERIC(12, 4),
        currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
        compare_at_price NUMERIC(12, 4),
        cost_price NUMERIC(12, 4),
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        valid_from TIMESTAMPTZ,
        valid_to TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT product_prices_unique_idx UNIQUE (price_list_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS product_prices_product_id_idx ON product_prices(product_id);
      CREATE INDEX IF NOT EXISTS product_prices_price_list_idx ON product_prices(price_list_id);

      CREATE TABLE IF NOT EXISTS variant_prices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_price_id UUID NOT NULL REFERENCES product_prices(id) ON DELETE CASCADE,
        variant_id VARCHAR(64) NOT NULL,
        price NUMERIC(12, 4) NOT NULL,
        compare_at_price NUMERIC(12, 4),
        cost_price NUMERIC(12, 4),
        sku VARCHAR(64),
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT variant_prices_unique_idx UNIQUE (product_price_id, variant_id)
      );
      CREATE INDEX IF NOT EXISTS variant_prices_variant_id_idx ON variant_prices(variant_id);

      CREATE TABLE IF NOT EXISTS price_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
        rule_type VARCHAR(32) NOT NULL,
        product_id VARCHAR(64),
        variant_id VARCHAR(64),
        min_quantity INTEGER DEFAULT 1 NOT NULL,
        max_quantity INTEGER,
        discount_type VARCHAR(32) NOT NULL,
        discount_value NUMERIC(12, 4) NOT NULL,
        priority INTEGER DEFAULT 0 NOT NULL,
        valid_from TIMESTAMPTZ,
        valid_to TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS price_rules_product_idx ON price_rules(product_id);
      CREATE INDEX IF NOT EXISTS price_rules_price_list_idx ON price_rules(price_list_id);
      CREATE INDEX IF NOT EXISTS price_rules_rule_type_idx ON price_rules(rule_type);

      CREATE TABLE IF NOT EXISTS price_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_price_id UUID NOT NULL REFERENCES product_prices(id) ON DELETE CASCADE,
        variant_price_id VARCHAR(64),
        old_price NUMERIC(12, 4) NOT NULL,
        new_price NUMERIC(12, 4) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
        change_reason TEXT NOT NULL,
        changed_by VARCHAR(64) NOT NULL,
        changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS price_history_product_price_idx ON price_history(product_price_id);
      CREATE INDEX IF NOT EXISTS price_history_changed_at_idx ON price_history(changed_at);

      CREATE TABLE IF NOT EXISTS price_quotes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id VARCHAR(64) NOT NULL UNIQUE,
        currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
        items JSONB NOT NULL,
        subtotal NUMERIC(12, 4) NOT NULL,
        total_discount NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        promotion_discount NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        final_total NUMERIC(12, 4) NOT NULL,
        customer_group VARCHAR(32),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS price_quotes_expires_at_idx ON price_quotes(expires_at);

      CREATE TABLE IF NOT EXISTS currency_rates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        base_currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
        target_currency VARCHAR(3) NOT NULL,
        exchange_rate NUMERIC(14, 6) NOT NULL,
        auto_refresh BOOLEAN DEFAULT TRUE NOT NULL,
        last_refreshed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT currency_rates_pair_idx UNIQUE (base_currency, target_currency)
      );
      CREATE INDEX IF NOT EXISTS currency_rates_target_idx ON currency_rates(target_currency);
    `);

    console.log("pricing-service database migrations completed successfully.");
  } catch (error) {
    console.error("Failed to run migrations:", error);
    throw error;
  } finally {
    client.release();
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
