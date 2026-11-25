# MLOps Standards — Larekmart

## Metadata

```yaml
name: mlops-standards
description: >
  Enterprise-grade MLOps standards for every AI/ML feature added to Larekmart.
  Load this skill whenever building, modifying, or reviewing any Python ML service
  (fraud-service, recommendation-service), AI assistant module (support-service), or
  any new ML/AI capability. Provides mandatory gates, folder conventions, tooling
  rules, and Definition of Done for ML changes.
alwaysLoad: false
triggers:
  - ml
  - machine learning
  - mlops
  - model training
  - inference
  - drift
  - feature engineering
  - mlflow
  - experiment tracking
  - recommendation
  - fraud detection
  - ai assistant
  - neural network
  - scikit-learn
  - pytorch
  - tensorflow
  - embedding
  - vector store
  - pgvector
  - celery worker
  - retraining
  - model registry
```

---

## 1. Scope & Services

| Service                       | Runtime                         | ML Responsibility                                                      |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| `apps/fraud-service`          | Python 3.12+ / FastAPI          | IsolationForest anomaly detection, PSI drift, batch scoring            |
| `apps/recommendation-service` | Python 3.12+ / FastAPI + Celery | pgvector HNSW hybrid ranking, offline eval, Celery retraining          |
| `apps/support-service`        | NestJS / TypeScript             | AI intent classification, KB retrieval, latency + confidence telemetry |
| `infrastructure/mlops/`       | Docker / K8s                    | MLflow Tracking Server, MinIO artifact store, DVC pipelines            |

---

## 2. Mandatory Folder Structure

Every ML service (`apps/<service>`) **MUST** have:

```
app/
  mlops/
    __init__.py
    validator.py          # Dataset & inference schema validation + quality gates
    drift_detector.py     # PSI-based online feature drift tracking
    registry.py           # Artifact registry (MLflow REST + local fallback)
    tuner.py              # Hyperparameter grid/random search
  api/
    routes/
      mlops.py            # GET /api/v1/<service>/mlops/status
tests/
  unit/
    test_mlops_<role>.py  # Full unit coverage for all mlops/ modules
```

---

## 3. Data & Model Quality Gates (Non-Negotiable)

### 3.1 Training Dataset Validation (`mlops/validator.py`)

Every training run **MUST** pass all checks before model fitting:

- **Finiteness**: No `NaN` or `Inf` in any feature column.
- **Schema conformity**: Required columns present with correct dtypes.
- **Domain bounds**: Feature values within domain-specific bounds (e.g. `amount ≥ 0`, `velocity ≥ 0`, `hour ∈ [0,23]`).
- **Minimum sample size**: Reject training if `len(df) < MIN_TRAINING_SAMPLES` (configurable via env, default 100).

```python
# Example gate pattern
def validate_training_dataset(df: pd.DataFrame) -> None:
    """Raises ValueError with descriptive message on first violation."""
    if df.isnull().any().any():
        raise ValueError("Training dataset contains NaN values")
    # ... additional checks
```

### 3.2 Model Quality Gate

After every training run:

- **Minimum separation margin** (IsolationForest): `mean_anomaly_score - mean_normal_score ≥ 0.02`.
- **Offline ranking metrics** (RecommendationService): `NDCG@10 ≥ 0.30`, `Precision@10 ≥ 0.15`, `Catalog Coverage ≥ 0.10`.
- **Reject & rollback** if gate fails: keep the previous production model; log gate rejection as a Prometheus counter.

```python
def evaluate_model_quality_gate(model, X_normal, X_anomaly) -> bool:
    """Returns True if model meets minimum quality bar, False otherwise."""
```

### 3.3 Inference Input Validation

All prediction endpoints **MUST**:

- Validate request schema via Pydantic models.
- Validate feature bounds before scoring (same ranges as training).
- Return structured `400` with field-level errors on schema violations.

---

## 4. Feature Drift Detection (PSI)

Every ML service **MUST** track Population Stability Index (PSI) for every high-variance input feature.

```
PSI < 0.10   → stable (no action)
0.10 ≤ PSI < 0.25 → moderate drift (warning log + Prometheus counter)
PSI ≥ 0.25   → significant drift (critical alert, trigger retraining)
```

Implementation:

- Use `app/mlops/drift_detector.py` with `compute_psi(expected, actual, bins=10)`.
- Record observations per request in an in-memory sliding window (default 1 000 samples).
- Expose drift state at `GET /api/v1/<service>/mlops/status` → `drift_psi` field per feature.
- Prometheus metric: `ml_feature_drift_psi{service, feature}`.

---

## 5. Model Registry & Artifact Management

All trained model artifacts **MUST** be versioned via `app/mlops/registry.py`:

1. **Primary**: MLflow Model Registry via `MLFLOW_TRACKING_URI` (env-configured).
2. **Fallback**: Local atomic filesystem registry under `ML_ARTIFACT_DIR` (default `./ml_artifacts/`).
3. **Integrity**: Every artifact file (`.joblib`, `.pkl`, ONNX, etc.) **MUST** ship with a SHA-256 `.manifest.json`.
4. **Immutable versions**: Model versions are never overwritten; always increment `v{major}.{minor}`.
5. **Experiment tracking**: Every run **MUST** log hyperparameters, metrics, and artifact path to MLflow.

```python
class ModelRegistryClient:
    def save_model(self, model, version: str, metrics: dict) -> str: ...
    def load_model(self, version: str): ...
    def compute_sha256(self, path: str) -> str: ...
```

---

## 6. Hyperparameter Management (`mlops/tuner.py`)

- Use deterministic grid search or random search (`random_state=42`) over tunable parameters.
- Hyperparameters **MUST** be declared in `params.yaml` (DVC) for reproducibility.
- Best hyperparameters are logged as MLflow run params.
- Never hardcode hyperparameters directly in training code — read from `params.yaml` or env vars.

---

## 7. MLOps API Endpoints (Mandatory for every ML service)

Every ML service **MUST** expose:

| Method | Path                                      | Auth            | Purpose                                                                |
| ------ | ----------------------------------------- | --------------- | ---------------------------------------------------------------------- |
| `GET`  | `/api/v1/<service>/mlops/status`          | Admin JWT       | Live health, model version, drift PSI per feature, quality gate status |
| `POST` | `/api/v1/internal/<service>/assess/batch` | Internal secret | Batch inference on array of inputs                                     |

Response schema for `/mlops/status`:

```json
{
  "model_version": "v1.2.0",
  "model_hash": "sha256:abc123",
  "is_model_loaded": true,
  "training_samples": 42000,
  "quality_gate_passed": true,
  "quality_gate_margin": 0.034,
  "drift_psi": { "amount": 0.08, "velocity": 0.03 },
  "inference_latency_p99_ms": 12.4,
  "total_predictions": 15000,
  "timestamp": "2026-11-25T00:00:00Z"
}
```

---

## 8. Observability & Monitoring

### 8.1 Prometheus Metrics (required for every ML service)

```python
# training
ml_training_duration_seconds{service}
ml_training_quality_gate_passed{service}  # 1 or 0
ml_training_total{service}

# inference
ml_inference_latency_seconds{service, endpoint}  # Histogram
ml_inference_total{service, endpoint, status}

# drift
ml_feature_drift_psi{service, feature}
ml_model_version{service, version}

# ranking (recommendation-service only)
ml_recommendation_ndcg_at_k{k}
ml_recommendation_precision_at_k{k}
ml_recommendation_catalog_coverage
```

### 8.2 Alerting Rules (`infrastructure/observability/prometheus/rules/alerts.yml`)

Add to `mlops_health` alert group for every new ML service:

```yaml
- alert: HighFeatureDriftDetected_<ServiceName>
  expr: ml_feature_drift_psi{service="<service-name>"} >= 0.25
  for: 5m
  severity: critical
  annotations:
    runbook: docs/MLOPS-ARCHITECTURE-AND-RUNBOOKS.md#drift-runbook

- alert: MLInferenceLatencyHigh_<ServiceName>
  expr: histogram_quantile(0.99, ml_inference_latency_seconds{service="<service-name>"}) > 0.5
  for: 10m
  severity: warning

- alert: MLTrainingQualityGateRejected_<ServiceName>
  expr: ml_training_quality_gate_passed{service="<service-name>"} == 0
  for: 1m
  severity: critical
```

### 8.3 Grafana Dashboard

Add panels to `infrastructure/observability/grafana/dashboards/mlops-observability.json`:

- PSI drift time series per feature per service.
- Inference latency p50/p95/p99 per endpoint.
- Training job duration and quality gate pass/fail.
- Model version gauge.

---

## 9. Continuous Training (CT) Pipeline

New ML services **MUST** add a Kubernetes `CronJob` in `infrastructure/kubernetes/base/mlops/retraining-cronjobs.yaml`:

```yaml
# Template — adjust schedule and service name
- name: <service>-daily-retrain
  schedule: "0 3 * * *" # UTC — stagger from other jobs
  image: ghcr.io/larekmart/<service>-training:sha-<commit>
  command: ["uv", "run", "python", "-m", "app.training.train"]
  resources:
    requests: { cpu: "500m", memory: "512Mi" }
    limits: { cpu: "2", memory: "2Gi" }
  restartPolicy: OnFailure
  backoffLimit: 2
```

Also add a CI step to `.github/workflows/mlops-ct-pipeline.yml`:

```yaml
- name: Run ML tests for <service>
  working-directory: apps/<service>
  run: uv run pytest tests/ -q --tb=short
```

---

## 10. Docker & Container Standards for ML Services

```dockerfile
# Base image — use uv for dependency management
FROM python:3.12-slim AS base
RUN pip install uv
WORKDIR /app

# Multi-stage: builder
FROM base AS builder
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Runner — non-root
FROM python:3.12-slim AS runner
RUN addgroup --system mluser && adduser --system --group mluser
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY . .
USER mluser
ENV PATH="/app/.venv/bin:$PATH"
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1
```

GPU inference images:

- Base: `nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04`
- Must include `HEALTHCHECK`.
- Must use a non-root user (`UID 1000`).
- Always pin CUDA and driver versions explicitly — never `:latest`.

---

## 11. Security for ML Artifacts & APIs

- **Model artifact storage** (MinIO/S3): Enable server-side encryption (`SSE-S3` or `SSE-KMS`). Bucket policy: deny public access, allow only ML service IAM role.
- **MLflow API**: Gate with admin auth token (`MLFLOW_TRACKING_TOKEN`). Never expose MLflow UI publicly without auth.
- **Internal batch scoring endpoints**: Require `x-internal-secret` header; validate with `crypto.timingSafeEqual` (Node.js) or `hmac.compare_digest` (Python).
- **Model artifacts in CI**: Upload via GitHub Actions OIDC — never embed AWS keys or MinIO credentials in workflow YAML.
- **RBAC**: Only `mlops-serviceaccount` K8s ServiceAccount may read/write to MLflow PVC and MinIO S3 bucket.

---

## 12. MLOps Definition of Done (DoD) Checklist

Before any ML feature is considered complete, **all** boxes must be checked:

- [ ] `app/mlops/validator.py` — training data + inference schema validation.
- [ ] `app/mlops/drift_detector.py` — PSI drift tracking for all high-variance features.
- [ ] `app/mlops/registry.py` — artifact save/load with SHA-256 integrity manifest.
- [ ] `app/mlops/tuner.py` — hyperparameters declared in `params.yaml`.
- [ ] `GET /api/v1/<service>/mlops/status` endpoint implemented and responds correctly.
- [ ] `POST /api/v1/internal/<service>/assess/batch` endpoint implemented (if applicable).
- [ ] All Prometheus metrics added (training, inference, drift, model version).
- [ ] Alert rules added to `infrastructure/observability/prometheus/rules/alerts.yml`.
- [ ] Grafana dashboard panels added/updated.
- [ ] Kubernetes `CronJob` added in `retraining-cronjobs.yaml`.
- [ ] CI step added to `mlops-ct-pipeline.yml`.
- [ ] `tests/unit/test_mlops_*.py` — ≥ 90% coverage, all pass (`uv run pytest`).
- [ ] `pnpm audit:mlops` passes (Trivy 0 misconfigs, all ML tests pass).
- [ ] `.env.example` updated with any new MLOps env vars (`MLFLOW_*`, `ML_*`).
- [ ] `docs/MLOPS-ARCHITECTURE-AND-RUNBOOKS.md` updated with new service section.
- [ ] `README.md` table updated with ML capabilities of the new service.
- [ ] Skills synced: `pnpm skills:sync`.

---

## 13. Environment Variables Reference

| Variable                       | Required | Description                                                                 |
| ------------------------------ | -------- | --------------------------------------------------------------------------- |
| `MLFLOW_TRACKING_URI`          | Yes      | MLflow tracking server (`http://localhost:5001` local, cluster URL in prod) |
| `MLFLOW_TRACKING_TOKEN`        | Prod     | Bearer token for MLflow REST API auth                                       |
| `MLFLOW_S3_ENDPOINT_URL`       | Yes      | MinIO/S3 endpoint for artifact store                                        |
| `ML_ARTIFACT_DIR`              | Yes      | Local fallback artifact directory (default `./ml_artifacts/`)               |
| `ML_MODEL_VERSION`             | Yes      | Active model version loaded at startup                                      |
| `MIN_TRAINING_SAMPLES`         | No       | Minimum rows required for training (default `100`)                          |
| `PSI_DRIFT_THRESHOLD_WARNING`  | No       | PSI warning threshold (default `0.10`)                                      |
| `PSI_DRIFT_THRESHOLD_CRITICAL` | No       | PSI critical threshold (default `0.25`)                                     |
| `AWS_ACCESS_KEY_ID`            | Yes      | MinIO/S3 access key for artifact storage                                    |
| `AWS_SECRET_ACCESS_KEY`        | Yes      | MinIO/S3 secret key for artifact storage                                    |

---

## 14. Local Development Setup

```bash
# 1. Start local MLOps stack (MLflow + MinIO + Postgres)
docker compose -f docker-compose.mlops.yml up -d

# 2. MLflow UI:  http://localhost:5001
# 3. MinIO UI:   http://localhost:9003  (admin/changemepass)

# 4. Run service with MLflow tracking
cd apps/fraud-service
cp .env.example .env   # fill in MLFLOW_TRACKING_URI=http://localhost:5001
uv run uvicorn app.main:app --reload

# 5. Run MLOps audit
pnpm audit:mlops
```

---

## 15. Rollback Strategy

```bash
# Automatic: MLflow model stage rollback
scripts/mlops-rollback.sh <service-name> <previous-version>

# Kubernetes: Image tag rollback
kubectl rollout undo deployment/<service-name> -n larekmart-production

# Verify
kubectl rollout status deployment/<service-name> -n larekmart-production
```

See full runbooks in `docs/MLOPS-ARCHITECTURE-AND-RUNBOOKS.md`.
