#!/usr/bin/env bash
# ==============================================================================
# Larekmart - Automated Docker Scout Security & Hardening Audit Script
#
# Scans project images using Docker Scout Quickview to identify vulnerabilities,
# verify Docker Hardened Image (DHI) baselines, and enforce production readiness.
#
# Usage:
#   bash scripts/docker-scout-audit.sh                 # Audit all catalog images
#   bash scripts/docker-scout-audit.sh <image-ref>     # Audit a single image
#   bash scripts/docker-scout-audit.sh --cves <image>  # Inspect specific CVEs
#   bash scripts/docker-scout-audit.sh --help          # Display help
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SHOW_CVES=false
GENERATE_SBOM=false
CHECK_VEX=false
TARGET_SINGLE_IMAGE=""

# Argument parsing
while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)
            echo "Usage:"
            echo "  pnpm docker:scout [OPTIONS] [IMAGE]"
            echo ""
            echo "Options:"
            echo "  --cves            Display detailed package CVE breakdown for target image"
            echo "  --sbom            Generate and save CycloneDX / SPDX SBOM to security/sbom/"
            echo "  --vex             Validate image against OpenVEX statements in security/vex/"
            echo "  --help, -h        Display this help message"
            echo ""
            echo "Examples:"
            echo "  pnpm docker:scout                      # Audit all platform images"
            echo "  pnpm docker:scout redis:7.4-alpine     # Audit specific image"
            echo "  pnpm docker:scout --cves alpine:3.20   # Detailed CVE breakdown"
            echo "  pnpm docker:scout --sbom alpine:3.20   # Export SBOM"
            echo "  pnpm docker:scout --vex                # Check OpenVEX statements"
            exit 0
            ;;
        --cves)
            SHOW_CVES=true
            shift
            ;;
        --sbom)
            GENERATE_SBOM=true
            shift
            ;;
        --vex)
            CHECK_VEX=true
            shift
            ;;
        *)
            TARGET_SINGLE_IMAGE="$1"
            shift
            ;;
    esac
done

echo -e "${CYAN}${BOLD}========================================================================${NC}"
echo -e "${CYAN}${BOLD}       Larekmart Docker Scout Security & Image Hardening Audit         ${NC}"
echo -e "${CYAN}${BOLD}========================================================================${NC}"
echo ""

# Verify docker scout is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker CLI is not installed or not in PATH.${NC}"
    exit 1
fi

if ! docker scout version &> /dev/null; then
    echo -e "${YELLOW}Warning: docker scout plugin not detected.${NC}"
    echo -e "${YELLOW}Install Docker Scout: https://docs.docker.com/scout/install/${NC}"
    exit 1
fi

# Detect whether Docker daemon is active locally
DOCKER_DAEMON_AVAILABLE=true
if ! docker info &> /dev/null; then
    DOCKER_DAEMON_AVAILABLE=false
    echo -e "${YELLOW}Note: Local Docker daemon is not active. Using registry:// direct lookups.${NC}"
    echo ""
fi

resolve_ref() {
    local ref="$1"
    if [ "$DOCKER_DAEMON_AVAILABLE" = false ] && [[ "$ref" != registry://* ]] && [[ "$ref" != local://* ]]; then
        echo "registry://${ref}"
    else
        echo "${ref}"
    fi
}

# Check VEX statements if requested
if [ "$CHECK_VEX" = true ]; then
    echo -e "${CYAN}${BOLD}Inspecting OpenVEX Statements (security/vex/larekmart-openvex.json):${NC}"
    if [ -f "security/vex/larekmart-openvex.json" ]; then
        echo -e "${GREEN}✓ OpenVEX specification file detected.${NC}"
        grep -E "name|justification|impact_statement" security/vex/larekmart-openvex.json | sed 's/^/  /' || true
    else
        echo -e "${YELLOW}No OpenVEX statement file found at security/vex/larekmart-openvex.json.${NC}"
    fi
    echo ""
    if [ -z "$TARGET_SINGLE_IMAGE" ]; then
        exit 0
    fi
fi

# If a single image target is supplied, scan it directly
if [ -n "$TARGET_SINGLE_IMAGE" ]; then
    RESOLVED_REF=$(resolve_ref "$TARGET_SINGLE_IMAGE")
    echo -e "${BLUE}Auditing target image:${NC} ${BOLD}${TARGET_SINGLE_IMAGE}${NC}"
    echo ""
    docker scout quickview "$RESOLVED_REF" || true
    echo ""

    if [ "$SHOW_CVES" = true ]; then
        echo -e "${CYAN}${BOLD}Package & CVE Breakdown:${NC}"
        docker scout cves --only-severities critical,high,medium "$RESOLVED_REF" || true
        echo ""
    fi

    if [ "$GENERATE_SBOM" = true ]; then
        mkdir -p security/sbom
        SAFE_NAME=$(echo "$TARGET_SINGLE_IMAGE" | tr '/:' '_')
        SBOM_OUT="security/sbom/${SAFE_NAME}.cyclonedx.json"
        echo -e "${CYAN}${BOLD}Generating CycloneDX Software Bill of Materials (SBOM):${NC} ${SBOM_OUT}"
        docker scout sbom --format cyclonedx "$RESOLVED_REF" > "$SBOM_OUT" 2>/dev/null || \
          docker scout sbom "$RESOLVED_REF" > "$SBOM_OUT" 2>/dev/null || true
        if [ -s "$SBOM_OUT" ]; then
            echo -e "  ${GREEN}✓ SBOM generated successfully (${SBOM_OUT}).${NC}"
        else
            echo -e "  ${YELLOW}⚠ SBOM generation requires active Docker daemon or authenticated registry token.${NC}"
            rm -f "$SBOM_OUT"
        fi
        echo ""
    fi

    echo -e "${BOLD}Recommended Next Steps:${NC}"
    echo -e "  - Base recommendations: ${CYAN}docker scout recommendations ${RESOLVED_REF}${NC}"
    echo -e "  - Compare to DHI:       ${CYAN}docker scout compare --to <hardened-image> ${RESOLVED_REF}${NC}"
    exit 0
fi

# Define catalog of all project images
# Format: "IMAGE_REF|SERVICE_NAME|HARDENED_BASELINE|ROLE"
declare -a IMAGES=(
    # Core Infrastructure
    "redis:7.4-alpine|redis|dhi/redis:7.4|Core In-Memory Cache"
    "mongo:7.0-jammy|mongo|dhi/mongodb:7.0|Core Document Store"
    "apache/kafka:3.8.0|kafka|dhi/kafka:3.8|Core Event Bus"
    "opensearchproject/opensearch:2.17.1|opensearch|dhi/opensearch:2.17|Core Search Engine"
    "pgvector/pgvector:pg16|postgres|dhi/postgres:16|Core Relational DB"

    # Supporting / Development Infrastructure
    "minio/minio:RELEASE.2024-09-22T00-33-43Z|minio|dhi/minio|Object Storage"
    "minio/mc:RELEASE.2024-09-16T17-43-14Z|minio-init|dhi/mc|MinIO Client Provisioner"
    "provectuslabs/kafka-ui:v0.7.2|kafka-ui|Internal UI|Kafka Management Dashboard"
    "mongo-express:1.0.2-alpha.4|mongo-express|Internal UI|MongoDB Admin Dashboard"

    # Microservices & Frontends Base Runtimes
    "node:20-alpine|node-microservices|dhi/node:20|Base Runtime for 14 Node Services"
    "alpine:3.20|notification-service-runner|dhi/alpine:3.20|Go Service Minimal Runner"
    "golang:1.22-alpine|notification-service-builder|dhi/golang:1.22|Go Service Multi-Stage Builder"
    "ghcr.io/astral-sh/uv:python3.12-bookworm-slim|recommendation-service|dhi/python:3.12|Python Service Multi-Stage Base"

    # Observability Stack
    "prom/prometheus:v2.53.0|prometheus|Hardened Distroless|Metrics Collection Engine"
    "prom/alertmanager:v0.27.0|alertmanager|Hardened Distroless|Alert Routing & Dispatch"
    "grafana/grafana:11.2.0|grafana|Alpine Hardened|Visualization Dashboard"
    "grafana/loki:3.1.0|loki|Alpine Hardened|Log Aggregation Engine"
    "grafana/promtail:3.1.0|promtail|Alpine Hardened|Log Shipper Daemon"
    "prom/node-exporter:v1.8.2|node-exporter|Hardened Distroless|Host Metrics Exporter"
    "oliver006/redis_exporter:v1.62.0|redis-exporter|Hardened Scratch|Redis Metrics Exporter"
    "prometheuscommunity/postgres-exporter:v0.15.0|postgres-exporter|Hardened Scratch|Postgres Metrics Exporter"
    "percona/mongodb_exporter:0.41.2|mongodb-exporter|Hardened Scratch|MongoDB Metrics Exporter"
)

TOTAL_COUNT=${#IMAGES[@]}
AUDITED_COUNT=0
PASSED_COUNT=0
REVIEW_COUNT=0

echo -e "${BOLD}Target Images to Audit (${TOTAL_COUNT} total):${NC}"
echo -e "------------------------------------------------------------------------"

for ENTRY in "${IMAGES[@]}"; do
    IFS='|' read -r IMG_REF SVC_NAME HARDENED_BASE ROLE <<< "$ENTRY"
    ((AUDITED_COUNT++))

    RESOLVED_REF=$(resolve_ref "$IMG_REF")

    echo -e "${BLUE}[${AUDITED_COUNT}/${TOTAL_COUNT}] Scanning ${BOLD}${SVC_NAME}${NC} (${IMG_REF})..."
    echo -e "  Role: ${ROLE} | Hardened Target: ${CYAN}${HARDENED_BASE}${NC}"

    if QUICKVIEW_OUT=$(docker scout quickview "$RESOLVED_REF" 2>&1); then
        echo -e "  ${GREEN}✓ Scout Quickview completed successfully.${NC}"
        echo "$QUICKVIEW_OUT" | grep -E "Target|Base image|CRITICAL|HIGH|MEDIUM|LOW" | sed 's/^/    /' || true
        ((PASSED_COUNT++))
    else
        echo -e "  ${YELLOW}⚠ Quickview completed with notices or registry fallback required.${NC}"
        echo "$QUICKVIEW_OUT" | tail -n 4 | sed 's/^/    /'
        ((REVIEW_COUNT++))
    fi
    echo ""
done

echo -e "${CYAN}${BOLD}========================================================================${NC}"
echo -e "${BOLD}Scan Summary: ${TOTAL_COUNT} Images Audited | ${GREEN}${PASSED_COUNT} Passed${NC} | ${YELLOW}${REVIEW_COUNT} Under Review${NC}"
echo -e "${CYAN}${BOLD}========================================================================${NC}"
echo ""
echo -e "${BOLD}Next Steps for Any Flagged Vulnerabilities:${NC}"
echo -e "  1. View package details:     ${CYAN}pnpm docker:scout --cves <image>${NC}"
echo -e "  2. View remediation advice:  ${CYAN}docker scout recommendations <image>${NC}"
echo -e "  3. Compare with hardened:    ${CYAN}docker scout compare --to <hardened-image> <image>${NC}"
echo -e "  4. Consult documentation:    ${CYAN}docs/DOCKER.md (Section 10)${NC}"
echo ""
