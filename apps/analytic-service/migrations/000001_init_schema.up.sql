-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Partitioned analytics_events table (Partition by RANGE on created_at)
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGSERIAL,
    event_type VARCHAR(100) NOT NULL,
    user_id VARCHAR(255),
    amount NUMERIC(12, 2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (created_at, id)
) PARTITION BY RANGE (created_at);

-- Default partition catches any event outside pre-created monthly partitions
CREATE TABLE IF NOT EXISTS analytics_events_default PARTITION OF analytics_events DEFAULT;

-- High-throughput BRIN index for block-level range queries on time-series appends
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at_brin ON analytics_events USING BRIN (created_at);

-- Composite B-Tree index for filtering by event_type and time ordering
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time ON analytics_events (event_type, created_at DESC);

-- B-Tree index for customer identity lookup
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events (user_id) WHERE user_id IS NOT NULL;

-- Daily aggregated analytics summary table
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
    date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    total_revenue NUMERIC(14, 2) DEFAULT 0,
    total_orders INT DEFAULT 0,
    total_signups INT DEFAULT 0,
    total_products_created INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_date ON analytics_daily_summary (date DESC);
