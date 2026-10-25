import { pool } from "./connection.js";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[SellerService] Running database migrations...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS sellers (
        id VARCHAR(64) PRIMARY KEY,
        vendor_id VARCHAR(64) NOT NULL,
        primary_user_id VARCHAR(128) NOT NULL,
        status VARCHAR(32) DEFAULT 'ONBOARDING' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sellers_vendor_id_idx ON sellers(vendor_id);
      CREATE INDEX IF NOT EXISTS sellers_primary_user_id_idx ON sellers(primary_user_id);
      CREATE INDEX IF NOT EXISTS sellers_status_idx ON sellers(status);

      CREATE TABLE IF NOT EXISTS seller_stores (
        id VARCHAR(64) PRIMARY KEY,
        seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
        name VARCHAR(128) NOT NULL,
        slug VARCHAR(128) NOT NULL UNIQUE,
        headline VARCHAR(256),
        description TEXT,
        logo_media_id VARCHAR(128),
        banner_media_id VARCHAR(128),
        status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        vacation_mode BOOLEAN DEFAULT FALSE NOT NULL,
        vacation_message TEXT,
        vacation_end_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS seller_stores_seller_id_idx ON seller_stores(seller_id);
      CREATE INDEX IF NOT EXISTS seller_stores_slug_idx ON seller_stores(slug);
      CREATE INDEX IF NOT EXISTS seller_stores_status_idx ON seller_stores(status);

      CREATE TABLE IF NOT EXISTS seller_staff (
        id VARCHAR(64) PRIMARY KEY,
        seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
        user_id VARCHAR(128) NOT NULL,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(32) DEFAULT 'MANAGER' NOT NULL,
        status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
        permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS seller_staff_seller_id_idx ON seller_staff(seller_id);
      CREATE INDEX IF NOT EXISTS seller_staff_user_id_idx ON seller_staff(user_id);

      CREATE TABLE IF NOT EXISTS seller_settings (
        id VARCHAR(64) PRIMARY KEY,
        seller_id VARCHAR(64) NOT NULL UNIQUE REFERENCES sellers(id) ON DELETE CASCADE,
        default_currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
        shipping_origin_postal_code VARCHAR(32),
        auto_accept_orders BOOLEAN DEFAULT TRUE NOT NULL,
        low_stock_threshold INTEGER DEFAULT 5 NOT NULL,
        support_email VARCHAR(255),
        support_phone VARCHAR(64),
        notification_preferences JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS seller_settings_seller_id_idx ON seller_settings(seller_id);

      CREATE TABLE IF NOT EXISTS seller_policies (
        id VARCHAR(64) PRIMARY KEY,
        seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
        policy_type VARCHAR(32) NOT NULL,
        title VARCHAR(128) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS seller_policies_seller_id_idx ON seller_policies(seller_id);
      CREATE INDEX IF NOT EXISTS seller_policies_type_idx ON seller_policies(seller_id, policy_type);

      CREATE TABLE IF NOT EXISTS seller_status_history (
        id VARCHAR(64) PRIMARY KEY,
        seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
        previous_status VARCHAR(32) NOT NULL,
        new_status VARCHAR(32) NOT NULL,
        reason TEXT NOT NULL,
        changed_by_user_id VARCHAR(128),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS seller_status_history_seller_id_idx ON seller_status_history(seller_id);

      CREATE TABLE IF NOT EXISTS seller_performance_snapshots (
        id VARCHAR(64) PRIMARY KEY,
        seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
        rating NUMERIC(3, 2) DEFAULT 0.00,
        total_reviews INTEGER DEFAULT 0 NOT NULL,
        order_fulfillment_rate NUMERIC(5, 2) DEFAULT 100.00,
        cancellation_rate NUMERIC(5, 2) DEFAULT 0.00,
        total_orders_completed INTEGER DEFAULT 0 NOT NULL,
        response_time_hours NUMERIC(5, 2) DEFAULT 24.00,
        calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS seller_perf_seller_id_idx ON seller_performance_snapshots(seller_id);

      CREATE TABLE IF NOT EXISTS system_settings (
        id VARCHAR(64) PRIMARY KEY,
        is_seller_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        is_seller_registration_open BOOLEAN DEFAULT TRUE NOT NULL,
        is_storefronts_active BOOLEAN DEFAULT TRUE NOT NULL,
        maintenance_message TEXT DEFAULT 'Marketplace seller operations are temporarily paused for routine maintenance.',
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_by VARCHAR(128)
      );

      ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS is_seller_registration_open BOOLEAN DEFAULT TRUE NOT NULL;
      ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS is_storefronts_active BOOLEAN DEFAULT TRUE NOT NULL;
      ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT 'Marketplace seller operations are temporarily paused for routine maintenance.';

      CREATE TABLE IF NOT EXISTS admin_delegations (
        id VARCHAR(64) PRIMARY KEY,
        admin_user_id VARCHAR(128) NOT NULL,
        permission VARCHAR(64) DEFAULT 'manage_sellers' NOT NULL,
        granted_by_user_id VARCHAR(128) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS admin_delegations_user_idx ON admin_delegations(admin_user_id);

      INSERT INTO system_settings (id, is_seller_enabled, is_seller_registration_open, is_storefronts_active, updated_at)
      VALUES ('marketplace', TRUE, TRUE, TRUE, NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("[SellerService] Migrations completed successfully.");
  } catch (error) {
    console.error("[SellerService] Failed to run migrations:", error);
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
