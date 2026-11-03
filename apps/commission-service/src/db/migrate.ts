import { pool } from "./connection.js";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[Migrate] Starting commission-service database migration...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS commission_plans (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        description TEXT,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        effective_to TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS commission_plans_status_idx ON commission_plans (status);
      CREATE INDEX IF NOT EXISTS commission_plans_is_default_idx ON commission_plans (is_default);

      CREATE TABLE IF NOT EXISTS commission_rules (
        id VARCHAR(64) PRIMARY KEY,
        plan_id VARCHAR(64) NOT NULL REFERENCES commission_plans(id) ON DELETE CASCADE,
        rule_type VARCHAR(32) NOT NULL DEFAULT 'PERCENTAGE',
        scope VARCHAR(32) NOT NULL DEFAULT 'GLOBAL',
        scope_id VARCHAR(128),
        percentage_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
        fixed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        min_commission NUMERIC(12, 2),
        max_commission NUMERIC(12, 2),
        priority INT NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        effective_to TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS commission_rules_plan_id_idx ON commission_rules (plan_id);
      CREATE INDEX IF NOT EXISTS commission_rules_scope_idx ON commission_rules (scope, scope_id);
      CREATE INDEX IF NOT EXISTS commission_rules_status_idx ON commission_rules (status);
      CREATE INDEX IF NOT EXISTS commission_rules_priority_idx ON commission_rules (priority);

      CREATE TABLE IF NOT EXISTS commission_rule_versions (
        id VARCHAR(64) PRIMARY KEY,
        rule_id VARCHAR(64) NOT NULL REFERENCES commission_rules(id) ON DELETE CASCADE,
        version INT NOT NULL,
        rule_snapshot JSONB NOT NULL,
        changed_by VARCHAR(128) NOT NULL,
        change_reason TEXT NOT NULL,
        valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        valid_to TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS commission_rule_versions_rule_id_idx ON commission_rule_versions (rule_id);
      CREATE INDEX IF NOT EXISTS commission_rule_versions_version_idx ON commission_rule_versions (version);

      CREATE TABLE IF NOT EXISTS commission_calculations (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(128) NOT NULL,
        seller_id VARCHAR(64) NOT NULL,
        subtotal NUMERIC(12, 2) NOT NULL,
        total_commission NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        net_seller_payout NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(8) NOT NULL DEFAULT 'PKR',
        status VARCHAR(32) NOT NULL DEFAULT 'QUOTED',
        calculation_snapshot JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS commission_calculations_order_id_idx ON commission_calculations (order_id);
      CREATE INDEX IF NOT EXISTS commission_calculations_seller_id_idx ON commission_calculations (seller_id);
      CREATE INDEX IF NOT EXISTS commission_calculations_status_idx ON commission_calculations (status);
      CREATE INDEX IF NOT EXISTS commission_calculations_created_at_idx ON commission_calculations (created_at);

      CREATE TABLE IF NOT EXISTS commission_line_items (
        id VARCHAR(64) PRIMARY KEY,
        calculation_id VARCHAR(64) NOT NULL REFERENCES commission_calculations(id) ON DELETE CASCADE,
        order_id VARCHAR(128) NOT NULL,
        order_item_id VARCHAR(128) NOT NULL,
        product_id VARCHAR(128) NOT NULL,
        category_id VARCHAR(128) NOT NULL,
        seller_id VARCHAR(64) NOT NULL,
        item_price NUMERIC(12, 2) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        commissionable_amount NUMERIC(12, 2) NOT NULL,
        rule_id VARCHAR(64) NOT NULL,
        rule_version INT NOT NULL DEFAULT 1,
        rate_applied NUMERIC(5, 2) NOT NULL,
        fee_calculated NUMERIC(12, 2) NOT NULL,
        min_max_applied BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS commission_line_items_calculation_id_idx ON commission_line_items (calculation_id);
      CREATE INDEX IF NOT EXISTS commission_line_items_order_id_idx ON commission_line_items (order_id);
      CREATE INDEX IF NOT EXISTS commission_line_items_product_id_idx ON commission_line_items (product_id);
      CREATE INDEX IF NOT EXISTS commission_line_items_seller_id_idx ON commission_line_items (seller_id);

      CREATE TABLE IF NOT EXISTS commission_adjustments (
        id VARCHAR(64) PRIMARY KEY,
        calculation_id VARCHAR(64) NOT NULL REFERENCES commission_calculations(id) ON DELETE CASCADE,
        order_id VARCHAR(128) NOT NULL,
        return_id VARCHAR(128),
        adjustment_type VARCHAR(32) NOT NULL,
        amount_adjusted NUMERIC(12, 2) NOT NULL,
        reason TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS commission_adjustments_calculation_id_idx ON commission_adjustments (calculation_id);
      CREATE INDEX IF NOT EXISTS commission_adjustments_order_id_idx ON commission_adjustments (order_id);
      CREATE INDEX IF NOT EXISTS commission_adjustments_return_id_idx ON commission_adjustments (return_id);

      -- Default Standard Marketplace Commission Plan
      INSERT INTO commission_plans (id, name, description, is_default, status)
      VALUES ('plan_default_marketplace', 'Standard Marketplace Commission Plan', 'Default platform commission rules across categories', TRUE, 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;

      -- Default Global 8% Rule
      INSERT INTO commission_rules (id, plan_id, rule_type, scope, percentage_rate, min_commission, priority, status)
      VALUES ('rule_default_global_8pct', 'plan_default_marketplace', 'PERCENTAGE', 'GLOBAL', 8.00, 10.00, 0, 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("[Migrate] commission-service database migration completed successfully.");
  } finally {
    client.release();
  }
}

// Run directly when called as CLI
if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Migrate] Migration failed:", err);
      process.exit(1);
    });
}
