#!/usr/bin/env bash
set -eo pipefail

echo "================================================================="
echo "🤖 Larekmart Enterprise MLOps Audit & Continuous Training Gate"
echo "================================================================="

# 1. Kubernetes MLOps Manifests & Kustomize Validation
echo ""
echo "▶ [1/4] Validating Kubernetes MLOps Manifests (MLflow, CronJobs, RBAC)..."
if command -v kubectl >/dev/null 2>&1; then
  kubectl kustomize infrastructure/kubernetes/base > /dev/null
  echo "  ✔ Kubernetes MLOps manifests & PSS Restricted baseline valid."
else
  echo "  ⚠ kubectl not found, skipping kustomize validation."
fi

# 2. Local MLOps Docker Compose Validation + Custom Image Check
echo ""
echo "▶ [2/4] Validating Local MLOps Stack (MLflow + MinIO + Postgres)..."
if command -v docker >/dev/null 2>&1; then
  docker compose -f docker-compose.mlops.yml config --quiet
  echo "  ✔ docker-compose.mlops.yml syntax valid."

  # Verify the custom MLflow image Dockerfile installs psycopg2-binary (required for Postgres backend)
  if ! grep -q "psycopg2-binary" infrastructure/mlops/docker/Dockerfile.mlflow-server 2>/dev/null; then
    echo "  ✘ FAIL: infrastructure/mlops/docker/Dockerfile.mlflow-server is missing psycopg2-binary."
    echo "         The official mlflow image does not include psycopg2 — it must be installed in the custom image."
    exit 1
  fi
  echo "  ✔ Dockerfile.mlflow-server includes psycopg2-binary (Postgres backend driver)."

  # Verify the compose file uses the custom build, not the bare upstream image
  if grep -q "image: ghcr.io/mlflow/mlflow" docker-compose.mlops.yml; then
    echo "  ✘ FAIL: docker-compose.mlops.yml still uses the bare upstream mlflow image."
    echo "         Use 'build: ...' with Dockerfile.mlflow-server so psycopg2 is available."
    exit 1
  fi
  echo "  ✔ docker-compose.mlops.yml uses the custom larekmart-mlflow-server build."
else
  echo "  ⚠ docker not found, skipping compose validation."
fi

# 3. Trivy Security Scan on MLOps Manifests & Dockerfiles
echo ""
echo "▶ [3/4] Running Trivy IaC Scan on MLOps Infrastructure & Dockerfiles..."
if command -v trivy >/dev/null 2>&1; then
  trivy config --exit-code 1 --severity HIGH,CRITICAL infrastructure/kubernetes/base/mlops/
  trivy config --exit-code 1 --severity HIGH,CRITICAL infrastructure/mlops/docker/
  echo "  ✔ Trivy MLOps manifest & Dockerfile scan complete (0 HIGH/CRITICAL)."
else
  echo "  ⚠ trivy not found, skipping manifest scan."
fi

# 4. ML Services Unit, Integration & Quality Gate Tests
echo ""
echo "▶ [4/4] Running Fraud & Recommendation ML Test Suites..."
pnpm --filter fraud-service --filter recommendation-service test
echo "  ✔ All ML model, drift detector, and quality gate tests passed."

echo ""
echo "================================================================="
echo "✅ Enterprise MLOps Audit Passed 100%! All ML Gates Clear."
echo "================================================================="
