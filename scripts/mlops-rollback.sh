#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# Larekmart - MLOps Model Rollback & Recovery Script
# Usage: bash scripts/mlops-rollback.sh <fraud|recommendation> [namespace]
# ==============================================================================

TARGET="${1:-}"
NAMESPACE="${2:-larekmart}"

if [[ -z "${TARGET}" ]]; then
  echo "Usage: $0 <fraud|recommendation> [namespace]"
  exit 1
fi

case "${TARGET}" in
  fraud)
    echo "▶ Rolling back fraud-service deployment in namespace '${NAMESPACE}'..."
    kubectl rollout undo deployment/fraud-service -n "${NAMESPACE}"
    kubectl rollout status deployment/fraud-service -n "${NAMESPACE}" --timeout=120s
    echo "✔ fraud-service rolled back to previous verified model revision."
    ;;
  recommendation)
    echo "▶ Rolling back recommendation-service deployment in namespace '${NAMESPACE}'..."
    kubectl rollout undo deployment/recommendation-service -n "${NAMESPACE}"
    kubectl rollout status deployment/recommendation-service -n "${NAMESPACE}" --timeout=120s
    echo "✔ recommendation-service rolled back to previous verified revision."
    ;;
  *)
    echo "❌ Unknown target '${TARGET}'. Must be 'fraud' or 'recommendation'."
    exit 1
    ;;
esac
