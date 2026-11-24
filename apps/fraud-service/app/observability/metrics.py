from prometheus_client import Counter, Gauge, Histogram

FRAUD_ASSESSMENTS_TOTAL = Counter(
    "fraud_assessments_total",
    "Total number of fraud risk assessments evaluated",
    ["workflow", "decision", "fail_mode_used"],
)

FRAUD_ASSESSMENT_DURATION_SECONDS = Histogram(
    "fraud_assessment_duration_seconds",
    "Duration of fraud risk assessments in seconds",
    ["workflow"],
    buckets=[0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

FRAUD_RULES_TRIGGERED_TOTAL = Counter(
    "fraud_rules_triggered_total",
    "Total number of rules triggered during risk assessment",
    ["rule_code", "workflow"],
)

FRAUD_CASES_CREATED_TOTAL = Counter(
    "fraud_cases_created_total",
    "Total number of fraud investigation cases created",
    ["workflow", "priority"],
)

FRAUD_CASES_RESOLVED_TOTAL = Counter(
    "fraud_cases_resolved_total",
    "Total number of fraud investigation cases resolved by analysts",
    ["decision"],
)

FRAUD_VELOCITY_CHECK_DURATION_SECONDS = Histogram(
    "fraud_velocity_check_duration_seconds",
    "Duration of Redis velocity sliding window checks in seconds",
    buckets=[0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1],
)

KAFKA_EVENTS_CONSUMED_TOTAL = Counter(
    "kafka_events_consumed_total",
    "Total number of Kafka events consumed by topic and status",
    ["topic", "status"],
)

KAFKA_EVENTS_FAILED_TOTAL = Counter(
    "kafka_events_failed_total",
    "Total number of Kafka event processing failures",
    ["topic", "error_type"],
)

# MLOps Metrics
ML_FEATURE_DRIFT_PSI = Gauge(
    "ml_feature_drift_psi",
    "Population Stability Index (PSI) drift score per inference feature",
    ["service", "feature"],
)

ML_INFERENCE_LATENCY_SECONDS = Histogram(
    "ml_inference_latency_seconds",
    "Latency of ML model inference calls in seconds",
    ["service", "model_name"],
    buckets=[0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1],
)

ML_MODEL_TRAINING_RUNS_TOTAL = Counter(
    "ml_model_training_runs_total",
    "Total number of ML training runs by status",
    ["service", "status"],
)

ML_MODEL_EVALUATION_MARGIN = Gauge(
    "ml_model_evaluation_margin",
    "Anomaly separation margin from the latest model quality gate",
    ["service", "model_name"],
)

