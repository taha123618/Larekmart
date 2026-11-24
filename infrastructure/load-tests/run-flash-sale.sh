#!/usr/bin/env bash
# ==============================================================================
# Larekmart Flash-Sale Load Test Runner (k6)
# Orchestrates test execution either via local k6 CLI or Dockerized k6 container.
# Validates latency percentiles, throughput (RPS), and zero-oversell invariants.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_URL="${TARGET_URL:-http://localhost:8090}"
ALLOCATED_STOCK="${ALLOCATED_STOCK:-100}"
HOT_PRODUCT_ID="${HOT_PRODUCT_ID:-1}"
HOT_VARIANT_ID="${HOT_VARIANT_ID:-var_flash_sale_hot_sku}"
CLERK_JWT_HMAC_KEY="${CLERK_JWT_HMAC_KEY:-larekmart_seller_hmac_secret_dev_key}"

echo "================================================================================"
echo "🚀 LAREKMART 50,000+ RPS FLASH SALE LOAD TEST & SAGA BENCHMARK"
echo "================================================================================"
echo "  • Ingress Target URL : ${TARGET_URL}"
echo "  • Allocated Stock    : ${ALLOCATED_STOCK} units"
echo "  • Hot SKU Identifier : Product #${HOT_PRODUCT_ID} (${HOT_VARIANT_ID})"
echo "================================================================================"

# 1. Seed & Warm Redis Stock Gatekeeper
if [ -f "${SCRIPT_DIR}/seed-flash-sale.sh" ]; then
  bash "${SCRIPT_DIR}/seed-flash-sale.sh"
fi

echo ""
echo "🔥 Starting k6 Flash-Sale Load Execution..."

if command -v k6 &>/dev/null; then
  echo "⚡ Using local k6 binary: $(which k6)"
  TARGET_URL="${TARGET_URL}" \
  ALLOCATED_STOCK="${ALLOCATED_STOCK}" \
  HOT_PRODUCT_ID="${HOT_PRODUCT_ID}" \
  HOT_VARIANT_ID="${HOT_VARIANT_ID}" \
  CLERK_JWT_HMAC_KEY="${CLERK_JWT_HMAC_KEY}" \
  k6 run "${SCRIPT_DIR}/flash-sale-k6.js"
elif command -v docker &>/dev/null; then
  echo "🐳 Local k6 not found. Running official grafana/k6 Docker container..."
  # Use host.docker.internal if targeting localhost
  DOCKER_TARGET_URL="${TARGET_URL/localhost/host.docker.internal}"
  DOCKER_TARGET_URL="${DOCKER_TARGET_URL/127.0.0.1/host.docker.internal}"

  docker run --rm -i \
    --network=larekmart-network \
    -e TARGET_URL="${DOCKER_TARGET_URL}" \
    -e ALLOCATED_STOCK="${ALLOCATED_STOCK}" \
    -e HOT_PRODUCT_ID="${HOT_PRODUCT_ID}" \
    -e HOT_VARIANT_ID="${HOT_VARIANT_ID}" \
    -e CLERK_JWT_HMAC_KEY="${CLERK_JWT_HMAC_KEY}" \
    -v "${SCRIPT_DIR}:/scripts:ro" \
    grafana/k6:latest run /scripts/flash-sale-k6.js
else
  echo "❌ Error: Neither k6 nor docker CLI is available in the current environment."
  echo "   Please install k6 (brew install k6) or start the Docker daemon."
  exit 1
fi

echo ""
echo "================================================================================"
echo "📊 Flash-Sale Benchmark Execution Completed."
echo "   Check Prometheus / Grafana dashboard (http://monitoring.localhost or :3001)"
echo "   for live throughput, connection pool saturation, and outbox relay lag."
echo "================================================================================"
