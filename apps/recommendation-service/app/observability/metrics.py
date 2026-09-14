from prometheus_client import Counter, Histogram, Gauge

# Request metrics
RECOMMENDATION_REQUESTS_TOTAL = Counter(
    "recommendation_requests_total",
    "Total number of recommendation requests",
    ["endpoint", "recommendation_type", "status"],
)

RECOMMENDATION_REQUEST_DURATION_SECONDS = Histogram(
    "recommendation_request_duration_seconds",
    "Duration of recommendation requests in seconds",
    ["endpoint", "recommendation_type"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

# Cache metrics
RECOMMENDATION_CACHE_HITS_TOTAL = Counter(
    "recommendation_cache_hits_total",
    "Total recommendation cache hits",
    ["cache_type"],
)

RECOMMENDATION_CACHE_MISSES_TOTAL = Counter(
    "recommendation_cache_misses_total",
    "Total recommendation cache misses",
    ["cache_type"],
)

# Generation metrics
RECOMMENDATION_GENERATION_TOTAL = Counter(
    "recommendation_generation_total",
    "Total recommendation generations executed",
    ["strategy", "fallback_used"],
)

RECOMMENDATION_GENERATION_ERRORS_TOTAL = Counter(
    "recommendation_generation_errors_total",
    "Total errors encountered during recommendation generation",
    ["strategy", "error_type"],
)

# Analytics metrics
RECOMMENDATION_IMPRESSIONS_TOTAL = Counter(
    "recommendation_impressions_total",
    "Total recommendation impressions displayed to users",
    ["strategy", "recommendation_type"],
)

RECOMMENDATION_CLICKS_TOTAL = Counter(
    "recommendation_clicks_total",
    "Total recommendation clicks by users",
    ["strategy", "recommendation_type"],
)

RECOMMENDATION_CONVERSIONS_TOTAL = Counter(
    "recommendation_conversions_total",
    "Total conversions from recommended items",
    ["strategy", "recommendation_type"],
)

# Messaging metrics
KAFKA_EVENTS_CONSUMED_TOTAL = Counter(
    "kafka_events_consumed_total",
    "Total Kafka events consumed and processed",
    ["topic", "status"],
)

KAFKA_EVENTS_FAILED_TOTAL = Counter(
    "kafka_events_failed_total",
    "Total Kafka events failed to process",
    ["topic", "error_type"],
)

# ML / Worker metrics
MODEL_TRAINING_DURATION_SECONDS = Histogram(
    "model_training_duration_seconds",
    "Duration of model training jobs in seconds",
    ["model_name"],
    buckets=[1.0, 5.0, 15.0, 30.0, 60.0, 180.0, 600.0],
)

EMBEDDING_GENERATION_DURATION_SECONDS = Histogram(
    "embedding_generation_duration_seconds",
    "Duration of embedding generation in seconds",
    ["provider"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
)
