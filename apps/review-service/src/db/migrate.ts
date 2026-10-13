import { pool } from "./connection.js";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("Running review-service database migrations...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_eligibility (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        order_id VARCHAR(255) NOT NULL,
        order_item_id VARCHAR(255) NOT NULL,
        delivered_at TIMESTAMPTZ NOT NULL,
        has_reviewed BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS purchase_eligibility_user_product_idx ON purchase_eligibility(user_id, product_id);
      CREATE INDEX IF NOT EXISTS purchase_eligibility_product_idx ON purchase_eligibility(product_id);
      CREATE INDEX IF NOT EXISTS purchase_eligibility_order_idx ON purchase_eligibility(order_id);

      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        author_name VARCHAR(255) NOT NULL,
        order_id VARCHAR(255),
        rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_verified_purchase BOOLEAN DEFAULT TRUE NOT NULL,
        status VARCHAR(50) DEFAULT 'APPROVED' NOT NULL,
        helpful_count INTEGER DEFAULT 0 NOT NULL,
        unhelpful_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_product_idx ON reviews(user_id, product_id);
      CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews(product_id);
      CREATE INDEX IF NOT EXISTS reviews_user_idx ON reviews(user_id);
      CREATE INDEX IF NOT EXISTS reviews_status_idx ON reviews(status);
      CREATE INDEX IF NOT EXISTS reviews_rating_idx ON reviews(rating);
      CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews(created_at);

      CREATE TABLE IF NOT EXISTS review_media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        media_id VARCHAR(255) NOT NULL,
        media_url VARCHAR(1024) NOT NULL,
        media_type VARCHAR(50) NOT NULL,
        display_order SMALLINT DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS review_media_review_idx ON review_media(review_id);

      CREATE TABLE IF NOT EXISTS review_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        vote_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS review_votes_review_user_idx ON review_votes(review_id, user_id);
      CREATE INDEX IF NOT EXISTS review_votes_review_idx ON review_votes(review_id);

      CREATE TABLE IF NOT EXISTS review_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        reason VARCHAR(50) NOT NULL,
        details TEXT,
        status VARCHAR(50) DEFAULT 'OPEN' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS review_reports_review_idx ON review_reports(review_id);
      CREATE INDEX IF NOT EXISTS review_reports_status_idx ON review_reports(status);

      CREATE TABLE IF NOT EXISTS review_moderation_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        moderator_id VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS review_moderation_review_idx ON review_moderation_actions(review_id);

      CREATE TABLE IF NOT EXISTS seller_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id UUID NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
        seller_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS seller_responses_review_idx ON seller_responses(review_id);
      CREATE INDEX IF NOT EXISTS seller_responses_seller_idx ON seller_responses(seller_id);

      CREATE TABLE IF NOT EXISTS product_rating_summaries (
        product_id VARCHAR(255) PRIMARY KEY,
        average_rating NUMERIC(3, 2) DEFAULT '0.00' NOT NULL,
        review_count INTEGER DEFAULT 0 NOT NULL,
        five_star_count INTEGER DEFAULT 0 NOT NULL,
        four_star_count INTEGER DEFAULT 0 NOT NULL,
        three_star_count INTEGER DEFAULT 0 NOT NULL,
        two_star_count INTEGER DEFAULT 0 NOT NULL,
        one_star_count INTEGER DEFAULT 0 NOT NULL,
        verified_count INTEGER DEFAULT 0 NOT NULL,
        last_calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);

    console.log("review-service database migrations completed successfully.");
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
