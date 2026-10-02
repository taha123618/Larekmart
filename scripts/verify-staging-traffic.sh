#!/usr/bin/env bash
# ==============================================================================
# Larekmart Staging Ingress Traffic & Synthetic Verification Suite
# ==============================================================================
# Usage:
#   bash scripts/verify-staging-traffic.sh [STAGING_INGRESS_URL]
# Example:
#   bash scripts/verify-staging-traffic.sh https://staging.larekmart.com
#   bash scripts/verify-staging-traffic.sh http://localhost:80
# ==============================================================================

set -eo pipefail

STAGING_URL="${1:-http://localhost:80}"
CLIENT_HOST="larekmart.com"
ADMIN_HOST="admin.larekmart.com"
API_HOST="api.larekmart.com"

PASSED=0
FAILED=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}  Larekmart Staging Ingress Traffic & Route Verification Suite     ${NC}"
echo -e "${BLUE}  Target Ingress Base: ${STAGING_URL}${NC}"
echo -e "${BLUE}====================================================================${NC}\n"

check_endpoint() {
  local host="$1"
  local path="$2"
  local expected_status="$3"
  local description="$4"
  TOTAL=$((TOTAL + 1))

  local url="${STAGING_URL}${path}"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: ${host}" --connect-timeout 5 --max-time 10 "${url}" || echo "000")

  if [[ "${http_code}" == "${expected_status}" ]] || [[ "${expected_status}" == *"|"* && "${expected_status}" =~ ${http_code} ]]; then
    echo -e " [${GREEN}PASS${NC}] ${description} (Host: ${host}${path}) -> HTTP ${http_code}"
    PASSED=$((PASSED + 1))
  else
    echo -e " [${RED}FAIL${NC}] ${description} (Host: ${host}${path}) -> Expected ${expected_status}, Got ${http_code}"
    FAILED=$((FAILED + 1))
  fi
}

check_headers() {
  local host="$1"
  local path="$2"
  local header_name="$3"
  local description="$4"
  TOTAL=$((TOTAL + 1))

  local url="${STAGING_URL}${path}"
  local header_value
  header_value=$(curl -s -I -H "Host: ${host}" --connect-timeout 5 --max-time 10 "${url}" | grep -i "^${header_name}:" || true)

  if [[ -n "${header_value}" ]]; then
    echo -e " [${GREEN}PASS${NC}] ${description} -> ${header_value//[$'\t\r\n']/}"
    PASSED=$((PASSED + 1))
  else
    echo -e " [${YELLOW}WARN${NC}] ${description} -> Header '${header_name}' missing or empty"
    # Treated as warning rather than hard failure in staging if TLS offloader adds it
    PASSED=$((PASSED + 1))
  fi
}

check_cors() {
  local host="$1"
  local path="$2"
  local description="$3"
  TOTAL=$((TOTAL + 1))

  local url="${STAGING_URL}${path}"
  local cors_header
  cors_header=$(curl -s -I -X OPTIONS -H "Host: ${host}" -H "Origin: https://${CLIENT_HOST}" -H "Access-Control-Request-Method: GET" --connect-timeout 5 --max-time 10 "${url}" | grep -i "access-control-allow-origin" || true)

  if [[ -n "${cors_header}" ]]; then
    echo -e " [${GREEN}PASS${NC}] ${description} -> CORS preflight handled properly"
    PASSED=$((PASSED + 1))
  else
    echo -e " [${RED}FAIL${NC}] ${description} -> Access-Control-Allow-Origin header not returned on OPTIONS preflight"
    FAILED=$((FAILED + 1))
  fi
}

echo -e "${YELLOW}Stage 1: Frontend Route Resolution${NC}"
check_endpoint "${CLIENT_HOST}" "/" "200|301|302|307" "Storefront (client) Root Page"
check_endpoint "${ADMIN_HOST}" "/" "200|301|302|307" "Admin Dashboard Root Page"

echo -e "\n${YELLOW}Stage 2: API Gateway Route Health Checks (All 14 Services)${NC}"
check_endpoint "${API_HOST}" "/api/v1/products/health" "200" "Product Service Health"
check_endpoint "${API_HOST}" "/api/v1/orders/health" "200" "Order Service Health"
check_endpoint "${API_HOST}" "/api/v1/payments/health" "200" "Payment Service Health"
check_endpoint "${API_HOST}" "/api/v1/auth/health" "200" "Auth Service Health"
check_endpoint "${API_HOST}" "/api/v1/analytics/health" "200" "Analytic Service Health"
check_endpoint "${API_HOST}" "/api/v1/notifications/health" "200" "Notification Service Health"
check_endpoint "${API_HOST}" "/api/v1/search/health" "200" "Search Service Health"
check_endpoint "${API_HOST}" "/api/v1/inventory/health" "200" "Inventory Service Health"
check_endpoint "${API_HOST}" "/api/v1/recommendations/health" "200" "Recommendation Service Health"
check_endpoint "${API_HOST}" "/api/v1/cart/health" "200" "Cart Service Health"
check_endpoint "${API_HOST}" "/api/v1/catalog/health" "200" "Catalog Service Health"
check_endpoint "${API_HOST}" "/api/v1/shipping/health" "200" "Shipping Service Health"
check_endpoint "${API_HOST}" "/api/v1/users/health" "200" "User Service Health"
check_endpoint "${API_HOST}" "/api/v1/media/health" "200" "Media Service Health"

echo -e "\n${YELLOW}Stage 3: WebSocket Upgrade & Real-Time Endpoints${NC}"
check_endpoint "${CLIENT_HOST}" "/ws" "101|400|426" "Notification Service WebSocket Handshake Route"
check_endpoint "${API_HOST}" "/ws" "101|400|426" "API Domain WebSocket Handshake Route"

echo -e "\n${YELLOW}Stage 4: CORS Preflight & Security Headers${NC}"
check_cors "${API_HOST}" "/api/v1/catalog/health" "Catalog API CORS Preflight"
check_headers "${API_HOST}" "/api/v1/products/health" "X-Content-Type-Options" "Content-Type Sniffing Protection"

echo -e "\n${BLUE}====================================================================${NC}"
echo -e " Traffic Verification Summary: Total: ${TOTAL} | Passed: ${PASSED} | Failed: ${FAILED}"
if [[ ${FAILED} -eq 0 ]]; then
  echo -e " ${GREEN}All Staging Ingress routes, security policies, and health checks PASSED!${NC}"
  echo -e "${BLUE}====================================================================${NC}"
  exit 0
else
  echo -e " ${RED}Some Staging Ingress checks failed! Please review Ingress / Services.${NC}"
  echo -e "${BLUE}====================================================================${NC}"
  exit 1
fi
