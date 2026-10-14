import { pool } from "./connection.js";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("Running wishlist-service database migrations...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS wishlists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255),
        guest_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE NOT NULL,
        visibility VARCHAR(50) DEFAULT 'PRIVATE' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS wishlists_user_idx ON wishlists(user_id);
      CREATE INDEX IF NOT EXISTS wishlists_guest_idx ON wishlists(guest_id);

      CREATE TABLE IF NOT EXISTS wishlist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
        product_id VARCHAR(255) NOT NULL,
        variant_id VARCHAR(255),
        added_price NUMERIC(12, 2) DEFAULT '0.00' NOT NULL,
        current_price NUMERIC(12, 2),
        in_stock BOOLEAN DEFAULT TRUE NOT NULL,
        note TEXT,
        priority SMALLINT DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_unique_item_idx 
        ON wishlist_items(wishlist_id, product_id, COALESCE(variant_id, ''));
      CREATE INDEX IF NOT EXISTS wishlist_items_wishlist_idx ON wishlist_items(wishlist_id);
      CREATE INDEX IF NOT EXISTS wishlist_items_product_idx ON wishlist_items(product_id);

      CREATE TABLE IF NOT EXISTS wishlist_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
        share_token VARCHAR(255) NOT NULL UNIQUE,
        permission VARCHAR(50) DEFAULT 'VIEW' NOT NULL,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS wishlist_shares_token_idx ON wishlist_shares(share_token);
      CREATE INDEX IF NOT EXISTS wishlist_shares_wishlist_idx ON wishlist_shares(wishlist_id);

      CREATE TABLE IF NOT EXISTS wishlist_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        actor_id VARCHAR(255) NOT NULL,
        payload JSONB DEFAULT '{}' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS wishlist_events_wishlist_idx ON wishlist_events(wishlist_id);
      CREATE INDEX IF NOT EXISTS wishlist_events_type_idx ON wishlist_events(event_type);
      CREATE INDEX IF NOT EXISTS wishlist_events_created_idx ON wishlist_events(created_at);
    `);

    console.log("wishlist-service database migrations completed successfully.");
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
