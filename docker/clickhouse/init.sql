-- ==============================================================================
-- Larekmart - ClickHouse Native Analytical Ingestion Engine Initialization
-- Provides:
--   1. Analytics Database and Columnar Tables (MergeTree Engine)
--   2. Native Kafka Engine Stream Ingestion (Zero-Compute Application Offloading)
--   3. Materialized Views for Auto-Streaming and Continuous Aggregation
--   4. SummingMergeTree Real-Time Rollups for Sub-Millisecond Dashboard KPIs
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS analytics_db;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Primary Compressed Columnar Storage (MergeTree)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_db.analytics_events (
    id         UUID DEFAULT generateUUIDv4(),
    event_type LowCardinality(String),
    user_id    String DEFAULT '',
    entity_id  String DEFAULT '',
    amount     Float64 DEFAULT 0.0,
    metadata   String DEFAULT '{}',
    timestamp  DateTime64(3, 'UTC') DEFAULT now64(),
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (event_type, timestamp, id)
SETTINGS index_granularity = 8192;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Daily Continuous Aggregate Rollup Table (SummingMergeTree)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_db.analytics_daily_summary (
    date          Date,
    event_type    LowCardinality(String),
    total_events  UInt64,
    total_revenue Float64
) ENGINE = SummingMergeTree((total_events, total_revenue))
PARTITION BY toYYYYMM(date)
ORDER BY (date, event_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Native Kafka Consumer Queue Engine Table
-- Consumes directly from Kafka brokers with zero compute overhead on Go/Node
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_db.kafka_analytics_events_queue (
    event_type String,
    user_id    Nullable(String),
    entity_id  Nullable(String),
    amount     Nullable(Float64),
    metadata   Nullable(String),
    timestamp  Nullable(DateTime64(3, 'UTC'))
) ENGINE = Kafka
SETTINGS kafka_broker_list = 'kafka-broker-1:9092,kafka-broker-2:9092,kafka-broker-3:9092',
         kafka_topic_list = 'order.created,payment.successful,cart.updated,inventory.stock.sold,user.created,review.created,pricing.price.updated',
         kafka_group_name = 'clickhouse-analytics-ingestion-group',
         kafka_format = 'JSONEachRow',
         kafka_num_consumers = 3,
         kafka_skip_broken_messages = 100;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Materialized Views for Continuous Zero-Overhead Streaming
-- ─────────────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_db.mv_kafka_to_analytics_events
TO analytics_db.analytics_events AS
SELECT
    generateUUIDv4() AS id,
    event_type,
    coalesce(user_id, '') AS user_id,
    coalesce(entity_id, '') AS entity_id,
    coalesce(amount, 0.0) AS amount,
    coalesce(metadata, '{}') AS metadata,
    coalesce(timestamp, now64()) AS timestamp,
    now() AS created_at
FROM analytics_db.kafka_analytics_events_queue;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_db.mv_kafka_to_daily_summary
TO analytics_db.analytics_daily_summary AS
SELECT
    toDate(coalesce(timestamp, now64())) AS date,
    event_type,
    count() AS total_events,
    sum(coalesce(amount, 0.0)) AS total_revenue
FROM analytics_db.kafka_analytics_events_queue
GROUP BY date, event_type;

