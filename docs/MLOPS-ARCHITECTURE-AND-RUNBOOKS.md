# Enterprise MLOps Architecture & Operational Runbooks — Larekmart

This document defines the production **MLOps Architecture, Continuous Training (CT) Pipelines, Model Serving Topology, Drift Monitoring, and Rollback Runbooks** for Larekmart's AI/ML microservices (`fraud-service` and `recommendation-service`).

---

## 1. AI/ML System Topology

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                     Larekmart Enterprise MLOps Architecture                       │
├────────────────────────┬───────────────────────────┬──────────────────────────────┤
│ Data & Feature Layer   │ Training & Registry (CT)  │ Serving & Drift Monitoring   │
├────────────────────────┼───────────────────────────┼──────────────────────────────┤
│ • PostgreSQL (pgvector)│ • K8s Scheduled CronJobs  │ • FastAPI REST Inference     │
│ • Redis Online Feature │ • Celery Offline Workers  │ • Kafka Streaming Inference  │
│   Store (Velocity/Cache│ • MLflow Tracking Server  │ • GPU Inference Node Pool    │
│ • DVC Reproducible     │ • MinIO S3 Artifact Store │ • PSI Feature Drift Detector │
│   Pipelines (dvc.yaml) │ • Quality Gate Validation │ • Prometheus + Grafana MLOps │
└────────────────────────┴───────────────────────────┴──────────────────────────────┘
```

### ML Services Inventory
1. **`apps/fraud-service` (Port 8024)**:
   - **Algorithm**: `IsolationForest` behavioral anomaly detector augmenting deterministic rules.
   - **Features**: `[amount, velocity, failed_attempts, hour]` (online velocity computed via Redis sliding-window).
   - **Serving Modes**: Real-time REST (`POST /api/v1/internal/fraud/assess`) and Kafka streaming consumer (`order.created`, `payment.succeeded`).
2. **`apps/recommendation-service` (Port 8008)**:
   - **Algorithms**: Hybrid ranking (Collaborative Filtering, Content-Based, Hashing/Dense Embeddings with `pgvector` HNSW similarity search).
   - **Serving Modes**: Real-time REST (`/api/v1/recommendations/*`), Kafka streaming consumers (`interaction`, `product`, `order`, `review`), and Celery batch workers.

---

## 2. Local MLOps Development Setup

Start the local **MLflow Tracking Server + MinIO S3 Artifact Store + Postgres Backend**:

```bash
docker compose -f docker-compose.mlops.yml up -d
```

- **MLflow UI**: `http://localhost:5001`
- **MinIO Console**: `http://localhost:9003`
- Point local ML services to MLflow:
  ```bash
  export MLFLOW_TRACKING_URI=http://localhost:5001
  export ML_ARTIFACT_DIR=./ml_artifacts
  ```

---

## 3. Reproducible Training, Validation & Continuous Training (CT)

### Dataset Validation & Quality Gates
- **Fraud Detection (`apps/fraud-service/app/mlops/validator.py`)**:
  - `validate_training_dataset` rejects datasets with `< 10` samples, wrong feature dimensions, `NaN`/`Inf` values, negative amounts/velocities, or out-of-range hours.
  - `evaluate_model_quality_gate` verifies that the trained `IsolationForest` achieves at least `min_separation_margin >= 0.02` between benign baseline traffic and canonical adversarial outliers before promotion.
- **Recommendations (`apps/recommendation-service/app/mlops/evaluator.py`)**:
  - `evaluate_ranking_quality` computes `Precision@K`, `Recall@K`, `NDCG@K`, and `Catalog Coverage` and enforces `NDCG@K >= min_ndcg`.

### DVC Reproducible Pipelines
Versioned hyperparameters and thresholds live in `infrastructure/mlops/params.yaml` and pipeline stages in `infrastructure/mlops/dvc.yaml`.

### GitHub Actions CI/CD & CT Workflow
`.github/workflows/mlops-ct-pipeline.yml` runs automatically on ML code PRs, main/staging pushes, and weekly Sunday `01:00 UTC` schedules:
1. Python linting (`ruff`) and `pytest` unit/integration suites.
2. Dataset validation, retraining, and quality gate enforcement.
3. Artifact persistence with SHA-256 checksum manifests.
4. Trivy security configuration scanning on Kubernetes MLOps manifests.

---

## 4. Kubernetes ML Infrastructure (`infrastructure/kubernetes/base/mlops/`)

- **MLflow Server (`mlflow-server.yaml`)**: Hardened Pod Security Standards (`restricted`) deployment with 20Gi PVC and non-root execution (`UID 1001`).
- **Scheduled Retraining (`retraining-cronjobs.yaml`)**:
  - `fraud-model-retraining`: Runs daily at `02:00 UTC`.
  - `recommendation-model-retraining`: Runs daily at `03:00 UTC`.
- **GPU Inference Template (`gpu-inference-template.yaml`)**: Pre-configured with `nvidia.com/gpu: "1"` limits, `nvidia-tesla-t4` nodeSelector, and GPU tolerations for neural rankers/embedding workloads.
- **RBAC (`mlops-rbac.yaml`)**: Least-privilege `mlops-trainer-sa` and `mlflow-server-sa` with `automountServiceAccountToken: false`.

---

## 5. Observability, Drift Detection & Alerting

- **Online PSI Feature Drift (`apps/fraud-service/app/mlops/drift_detector.py`)**:
  - Computes Population Stability Index (PSI) across a sliding inference window (`amount`, `velocity`, `failed_attempts`, `hour`).
  - Thresholds: `< 0.10` (`OK`), `0.10–0.25` (`MODERATE_DRIFT`), `>= 0.25` (`HIGH_DRIFT`).
  - Admin inspection endpoint: `GET /api/v1/admin/fraud/mlops/status`.
- **Prometheus Metrics & Alerts (`infrastructure/observability/prometheus/rules/alerts.yml`)**:
  - `HighFeatureDriftDetected`: Fires when `ml_feature_drift_psi > 0.25` for 5m.
  - `MLInferenceLatencyHigh`: Fires when P95 `ml_inference_latency_seconds > 100ms`.
  - `MLTrainingQualityGateRejected`: Critical alert when a CT run fails dataset or evaluation gates.
- **Grafana Dashboard**: `infrastructure/observability/grafana/dashboards/mlops-observability.json`.

---

## 6. Model Rollback & Disaster Recovery Runbook

### Immediate Model Rollback
1. **Fraud Service**: Every promoted model writes a `<model_name>_<model_id>.joblib` and `.manifest.json` with SHA-256 verification. To roll back, invoke `POST /api/v1/admin/fraud/models/retrain` with the last known good `n_estimators`/`contamination` from `params.yaml`, or restart pods to revert to the verified baseline artifact.
2. **Recommendation Service**: In `recommendation_db`, toggle `is_active = false` on the degraded `RecommendationModel` row and set `is_active = true` on the previous verified `version` tag, then flush Redis recommendation cache keys.
3. **Audit Verification**: Run `pnpm audit:mlops` after any rollback to verify all ML tests, Kustomize manifests, and quality gates pass.
