# Fraud Detection & Risk Scoring Service

Production-ready microservice for real-time risk assessment, velocity abuse detection, coupon abuse prevention, and seller payout fraud protection across the Larekmart platform.

## Features

- **Multi-Workflow Risk Assessment**: Evaluate transactions in `PAYMENT`, `ORDER`, `ACCOUNT`, `PROMOTION`, `PAYOUT`, and `SELLER` workflows.
- **Explainable Scoring Engine**: Composite score ($0-100$) derived from rules, velocity counters, and ML anomaly detection.
- **Sliding-Window Velocity**: Sub-millisecond tracking of transaction velocity, IP hopping, and failed card attempts via Redis sorted sets.
- **scikit-learn Anomaly Detection**: `IsolationForest` unsupervised model for statistical outlier detection with graceful bootstrapping fallbacks.
- **Case Management**: Automated case escalation for `REVIEW` or `BLOCK` decisions with analyst audit trails.
- **Zero-Trust Security**: Constant-time internal secret comparison and Clerk Admin JWT verification.
- **OpenTelemetry & Prometheus**: Latency histograms, rule trigger counters, and decision distributions on `/metrics`.

## Tech Stack

- Python 3.12+ / FastAPI / Pydantic v2
- SQLAlchemy 2.0 / PostgreSQL (`fraud_db`) / Alembic
- Redis (Sliding-window velocity counters)
- Kafka (`aiokafka`)
- scikit-learn / NumPy / Pandas
- OpenTelemetry / Prometheus / structlog

## Endpoints

```
POST /api/v1/internal/fraud/assess           # Risk assessment
GET  /api/v1/internal/fraud/assessments/:id  # Audit trail for assessment
GET  /api/v1/admin/fraud/cases               # Query investigation queue
POST /api/v1/admin/fraud/cases/:id/review    # Submit analyst decision
POST /api/v1/admin/fraud/rules               # Add/update custom rules
GET  /health                                 # Health check
GET  /metrics                                # Prometheus metrics
```

