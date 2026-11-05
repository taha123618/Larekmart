# Fraud Detection & Risk Scoring Service

Production-ready microservice for real-time risk assessment, velocity abuse detection, coupon abuse prevention, and seller payout fraud protection across the Larekmart platform.

## Features

- **Multi-Workflow Risk Assessment**: Evaluate transactions in `PAYMENT`, `ORDER`, `ACCOUNT`, `PROMOTION`, `PAYOUT`, and `SELLER` workflows.
- **Explainable Scoring Engine**: Composite score ($0-100$) derived from rules, velocity counters, and ML anomaly detection.
- **Sliding-Window Velocity**: Sub-millisecond tracking of transaction velocity, IP hopping, and failed card attempts via Redis sorted sets.
- **scikit-learn Anomaly Detection**: `IsolationForest` unsupervised model for statistical outlier detection with graceful bootstrapping fallbacks.
- **Case Management**: Automated case escalation for `REVIEW` or `BLOCK` decisions with immutable analyst audit trails.
- **External Risk Provider Integration**: Extensible adapter pattern (`BaseRiskProvider`) for reputation intelligence (disposable email domains, Tor/VPN proxy networks, Sift/MaxMind).
- **Model Lifecycle & Retraining**: Admin endpoints for querying model versions (`risk_model_versions`) and triggering live scikit-learn retraining.
- **False Positive & Accuracy Tracking**: Performance metrics endpoint tracking false positive rate, true block rate, and per-rule trigger statistics.
- **Zero-Trust Security**: Constant-time internal secret comparison and Clerk Admin JWT verification.
- **OpenTelemetry & Prometheus**: Distributed tracing with `FastAPIInstrumentor`, latency histograms, rule trigger counters, and decision distributions on `/metrics`.

## Tech Stack

- Python 3.12+ / FastAPI / Pydantic v2
- SQLAlchemy 2.0 / PostgreSQL (`larekmart_fraud_db`) / Alembic
- Redis (Sliding-window velocity counters)
- Kafka (`aiokafka`)
- scikit-learn / NumPy / Pandas
- OpenTelemetry / Prometheus / structlog

## Endpoints

```
POST  /api/v1/internal/fraud/assess                # Real-time risk assessment
GET   /api/v1/internal/fraud/assessments/:id       # Audit trail for assessment
GET   /api/v1/admin/fraud/cases                    # Query investigation queue
GET   /api/v1/admin/fraud/cases/:id/decisions      # Chronological analyst audit trail
POST  /api/v1/admin/fraud/cases/:id/review         # Submit analyst decision (APPROVE/BLOCK/DISMISS)
GET   /api/v1/admin/fraud/rules                    # Query configurable scoring rules
POST  /api/v1/admin/fraud/rules                    # Add/update custom rules
PATCH /api/v1/admin/fraud/rules/:id/toggle         # Activate or deactivate rule
GET   /api/v1/admin/fraud/performance              # Performance metrics & false positive analytics
GET   /api/v1/admin/fraud/models                   # List trained anomaly model versions
POST  /api/v1/admin/fraud/models/retrain           # Retrain scikit-learn IsolationForest model
GET   /health                                      # Health check
GET   /metrics                                     # Prometheus metrics
```
