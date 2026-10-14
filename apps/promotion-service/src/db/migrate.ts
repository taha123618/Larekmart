import { pool } from "./connection.js";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("Running promotion-service database migrations...");

    await client.query(`
      DROP TABLE IF EXISTS promotion_redemptions CASCADE;
      DROP TABLE IF EXISTS promotion_reservations CASCADE;
      DROP TABLE IF EXISTS coupon_codes CASCADE;
      DROP TABLE IF EXISTS promotion_targets CASCADE;
      DROP TABLE IF EXISTS promotion_rules CASCADE;
      DROP TABLE IF EXISTS promotion_budgets CASCADE;
      DROP TABLE IF EXISTS promotion_audit_logs CASCADE;
      DROP TABLE IF EXISTS promotions CASCADE;

      CREATE TABLE IF NOT EXISTS promotions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        discount_value NUMERIC(12, 2) NOT NULL,
        max_discount_amount NUMERIC(12, 2),
        status VARCHAR(50) DEFAULT 'DRAFT' NOT NULL,
        priority INTEGER DEFAULT 0 NOT NULL,
        is_stackable BOOLEAN DEFAULT FALSE NOT NULL,
        start_date TIMESTAMPTZ NOT NULL,
        end_date TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS promotions_status_idx ON promotions(status);
      CREATE INDEX IF NOT EXISTS promotions_dates_idx ON promotions(start_date, end_date);
      CREATE INDEX IF NOT EXISTS promotions_type_idx ON promotions(type);
      CREATE INDEX IF NOT EXISTS promotions_priority_idx ON promotions(priority);

      CREATE TABLE IF NOT EXISTS promotion_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
        min_order_amount NUMERIC(12, 2) DEFAULT '0.00' NOT NULL,
        customer_segment VARCHAR(50) DEFAULT 'ALL' NOT NULL,
        max_per_customer INTEGER DEFAULT 1 NOT NULL,
        global_limit INTEGER,
        usage_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS promotion_rules_promo_idx ON promotion_rules(promotion_id);

      CREATE TABLE IF NOT EXISTS promotion_targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
        target_type VARCHAR(50) NOT NULL,
        target_id VARCHAR(255),
        rule_type VARCHAR(50) DEFAULT 'INCLUDE' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS promotion_targets_promo_idx ON promotion_targets(promotion_id);
      CREATE INDEX IF NOT EXISTS promotion_targets_lookup_idx ON promotion_targets(target_type, target_id);

      CREATE TABLE IF NOT EXISTS coupon_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
        code VARCHAR(100) NOT NULL,
        max_redemptions INTEGER,
        redemptions_count INTEGER DEFAULT 0 NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS coupon_codes_code_unique ON coupon_codes(code);
      CREATE INDEX IF NOT EXISTS coupon_codes_promo_idx ON coupon_codes(promotion_id);
      CREATE INDEX IF NOT EXISTS coupon_codes_active_idx ON coupon_codes(is_active);

      CREATE TABLE IF NOT EXISTS promotion_reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
        coupon_id UUID REFERENCES coupon_codes(id) ON DELETE SET NULL,
        user_id VARCHAR(255),
        guest_id VARCHAR(255),
        order_id VARCHAR(255),
        discount_amount NUMERIC(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'RESERVED' NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        committed_at TIMESTAMPTZ,
        released_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS promotion_reservations_promo_idx ON promotion_reservations(promotion_id);
      CREATE INDEX IF NOT EXISTS promotion_reservations_status_idx ON promotion_reservations(status);
      CREATE INDEX IF NOT EXISTS promotion_reservations_expires_idx ON promotion_reservations(expires_at);
      CREATE INDEX IF NOT EXISTS promotion_reservations_user_idx ON promotion_reservations(user_id);
      CREATE INDEX IF NOT EXISTS promotion_reservations_guest_idx ON promotion_reservations(guest_id);

      CREATE TABLE IF NOT EXISTS promotion_redemptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
        coupon_id UUID REFERENCES coupon_codes(id) ON DELETE SET NULL,
        reservation_id UUID REFERENCES promotion_reservations(id) ON DELETE SET NULL,
        user_id VARCHAR(255),
        order_id VARCHAR(255) NOT NULL,
        discount_amount NUMERIC(12, 2) NOT NULL,
        redeemed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS promotion_redemptions_order_idx ON promotion_redemptions(order_id);
      CREATE INDEX IF NOT EXISTS promotion_redemptions_promo_idx ON promotion_redemptions(promotion_id);
      CREATE INDEX IF NOT EXISTS promotion_redemptions_user_idx ON promotion_redemptions(user_id);
      CREATE INDEX IF NOT EXISTS promotion_redemptions_redeemed_idx ON promotion_redemptions(redeemed_at);

      CREATE TABLE IF NOT EXISTS promotion_budgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
        total_budget NUMERIC(14, 2) NOT NULL,
        reserved_amount NUMERIC(14, 2) DEFAULT '0.00' NOT NULL,
        spent_amount NUMERIC(14, 2) DEFAULT '0.00' NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS promotion_budgets_promo_unique ON promotion_budgets(promotion_id);

      CREATE TABLE IF NOT EXISTS promotion_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(50) DEFAULT 'PROMOTION' NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        performed_by VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS promotion_audit_entity_idx ON promotion_audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS promotion_audit_created_idx ON promotion_audit_logs(created_at);
    `);

    console.log("promotion-service database migrations completed successfully.");
  } catch (error) {
    console.error("Failed to run promotion-service migrations:", error);
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
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
