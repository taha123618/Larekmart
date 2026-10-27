import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5433/analytics_db",
});

let isDbConnected = false;

export const initAnalyticsDB = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    console.log("Analytics Service connected to PostgreSQL");
    isDbConnected = true;

    // Initialize analytics event log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        user_id VARCHAR(255),
        amount NUMERIC(12, 2),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Initialize daily aggregate metrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_daily_summary (
        date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
        total_revenue NUMERIC(14, 2) DEFAULT 0,
        total_orders INT DEFAULT 0,
        total_signups INT DEFAULT 0,
        total_products_created INT DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    client.release();
    return true;
  } catch (error) {
    console.warn(
      "Analytics DB connection not available or initialized. Operating in resilient in-memory mode.",
      error instanceof Error ? error.message : error,
    );
    isDbConnected = false;
    return false;
  }
};

export const getDbStatus = (): boolean => isDbConnected;
