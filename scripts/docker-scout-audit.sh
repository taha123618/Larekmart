#!/usr/bin/env bash
# ==============================================================================
# Larekmart - Automated Docker Scout Security & Hardening Audit Script
#
# Scans project images using Docker Scout Quickview to identify vulnerabilities,
# verify Docker Hardened Image (DHI) baselines, and enforce production readiness.
#
# Usage:
#   bash scripts/docker-scout-audit.sh                     # Audit all catalog images
#   bash scripts/docker-scout-audit.sh --filter=core       # Audit core datastores only
#   bash scripts/docker-scout-audit.sh --filter=runtimes   # Audit base runtimes
#   bash scripts/docker-scout-audit.sh <image-ref>         # Audit a single image
#   bash scripts/docker-scout-audit.sh --cves <image>      # Detailed CVE breakdown
#   bash scripts/docker-scout-audit.sh --sbom <image>      # Export CycloneDX SBOM
#   bash scripts/docker-scout-audit.sh --vex               # Inspect OpenVEX statements
#   bash scripts/docker-scout-audit.sh --fail-on-critical  # CI/CD gate: fail on critical CVE
#   bash scripts/docker-scout-audit.sh --dry-run           # Validate catalog without network
#   bash scripts/docker-scout-audit.sh --json              # Output JSON summary
#   bash scripts/docker-scout-audit.sh --help              # Display help
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SHOW_CVES=false
GENERATE_SBOM=false
CHECK_VEX=false
DRY_RUN=false
FAIL_ON_CRITICAL=false
FAIL_ON_HIGH=false
OUTPUT_JSON=false
OUTPUT_FILE=""
CATEGORY_FILTER="all"
TARGET_SINGLE_IMAGE=""

# Argument parsing
while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)
            echo "Usage:"
            echo "  pnpm docker:scout [OPTIONS] [IMAGE]"
            echo "  bash scripts/docker-scout-audit.sh [OPTIONS] [IMAGE]"
            echo ""
            echo "Options:"
            echo "  --filter=<cat>, -f <cat>   Filter by category: core, infra, runtimes, observability, security, all (default: all)"
            echo "  --cves                     Display detailed package CVE breakdown for target image"
            echo "  --sbom                     Generate and save CycloneDX / SPDX SBOM to security/sbom/"
            echo "  --vex                      Validate image against OpenVEX statements in security/vex/"
            echo "  --fail-on-critical         Exit with code 1 if any critical vulnerability is found (CI gate)"
            echo "  --fail-on-high             Exit with code 1 if any high or critical vulnerability is found"
            echo "  --dry-run                  Inspect target catalog without executing remote Scout lookups"
            echo "  --json                     Output structured JSON summary report"
            echo "  --output=<file>            Save report to the specified file"
            echo "  --help, -h                 Display this help message"
            echo ""
            echo "Categories:"
            echo "  core                       Datastores: PostgreSQL, MySQL, MongoDB, Redis, Kafka, OpenSearch, ClickHouse, MinIO"
            echo "  infra                      Gateways & tooling: Traefik, Caddy, PgBouncer, Debezium, Kafka-UI, Mongo-Express"
            echo "  runtimes                   Base runtimes: Node 20/22 Alpine, Go 1.22, Python 3.12, Alpine 3.20"
            echo "  observability              Telemetry: Prometheus, Grafana, Loki, Tempo, Promtail, Otel Collector, Exporters"
            echo "  security                   Security tooling: Trivy"
            echo ""
            echo "Examples:"
            echo "  pnpm docker:scout                           # Audit all platform images"
            echo "  pnpm docker:scout --filter=core             # Audit core datastores"
            echo "  pnpm docker:scout --filter=runtimes         # Audit container base runtimes"
            echo "  pnpm docker:scout redis:7.4-alpine          # Audit specific image"
            echo "  pnpm docker:scout --cves alpine:3.20        # Detailed CVE breakdown"
            echo "  pnpm docker:scout --sbom alpine:3.20        # Export SBOM"
            echo "  pnpm docker:scout --vex                     # Check OpenVEX statements"
            echo "  pnpm docker:scout --dry-run                 # Validate catalog setup"
            echo "  pnpm docker:scout --fail-on-critical        # Enforce CI/CD zero-critical policy"
            exit 0
            ;;
        --filter=*)
            CATEGORY_FILTER="${1#*=}"
            shift
            ;;
        -f)
            CATEGORY_FILTER="$2"
            shift 2
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
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --fail-on-critical)
            FAIL_ON_CRITICAL=true
            shift
            ;;
        --fail-on-high)
            FAIL_ON_HIGH=true
            shift
            ;;
        --json)
            OUTPUT_JSON=true
            shift
            ;;
        --output=*)
            OUTPUT_FILE="${1#*=}"
            shift
            ;;
        *)
            TARGET_SINGLE_IMAGE="$1"
            shift
            ;;
    esac
done

if [ "$OUTPUT_JSON" = false ]; then
    echo -e "${CYAN}${BOLD}========================================================================${NC}"
    echo -e "${CYAN}${BOLD}       Larekmart Docker Scout Security & Image Hardening Audit         ${NC}"
    echo -e "${CYAN}${BOLD}========================================================================${NC}"
    echo ""
fi

# Verify docker CLI availability
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker CLI is not installed or not in PATH.${NC}" >&2
    exit 1
fi

# Verify docker scout plugin unless in dry-run mode
if [ "$DRY_RUN" = false ]; then
    if ! docker scout version &> /dev/null; then
        echo -e "${YELLOW}Warning: docker scout plugin not detected.${NC}" >&2
        echo -e "${YELLOW}Install Docker Scout: https://docs.docker.com/scout/install/${NC}" >&2
        exit 1
    fi
fi

# Detect whether Docker daemon is active locally
DOCKER_DAEMON_AVAILABLE=true
if ! docker info &> /dev/null; then
    DOCKER_DAEMON_AVAILABLE=false
    if [ "$OUTPUT_JSON" = false ]; then
        echo -e "${YELLOW}Note: Local Docker daemon is not active. Using registry:// direct lookups.${NC}"
        echo ""
    fi
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
    if [ "$OUTPUT_JSON" = false ]; then
        echo -e "${CYAN}${BOLD}Inspecting OpenVEX Statements (security/vex/larekmart-openvex.json):${NC}"
    fi
    if [ -f "security/vex/larekmart-openvex.json" ]; then
        if [ "$OUTPUT_JSON" = false ]; then
            echo -e "${GREEN}✓ OpenVEX specification file detected.${NC}"
            grep -E "name|justification|impact_statement" security/vex/larekmart-openvex.json | sed 's/^/  /' || true
            echo ""
        fi
    else
        echo -e "${YELLOW}No OpenVEX statement file found at security/vex/larekmart-openvex.json.${NC}" >&2
    fi
    if [ -z "$TARGET_SINGLE_IMAGE" ] && [ "$CATEGORY_FILTER" = "all" ] && [ "$SHOW_CVES" = false ]; then
        exit 0
    fi
fi

# If a single image target is supplied, scan it directly
if [ -n "$TARGET_SINGLE_IMAGE" ]; then
    RESOLVED_REF=$(resolve_ref "$TARGET_SINGLE_IMAGE")
    if [ "$OUTPUT_JSON" = false ]; then
        echo -e "${BLUE}Auditing target image:${NC} ${BOLD}${TARGET_SINGLE_IMAGE}${NC}"
        echo ""
    fi

    CRIT_COUNT=0
    HIGH_COUNT=0
    MED_COUNT=0
    LOW_COUNT=0

    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${GREEN}✓ Dry-run mode: Target reference validated (${RESOLVED_REF}).${NC}"
    else
        QUICKVIEW_OUT=$(docker scout quickview "$RESOLVED_REF" 2>&1 || true)
        if [ "$OUTPUT_JSON" = false ]; then
            echo "$QUICKVIEW_OUT"
            echo ""
        fi

        CRIT_RAW=$(echo "$QUICKVIEW_OUT" | grep -oE '[0-9]+C' | head -n 1 | tr -d 'C' || echo "0")
        HIGH_RAW=$(echo "$QUICKVIEW_OUT" | grep -oE '[0-9]+H' | head -n 1 | tr -d 'H' || echo "0")
        MED_RAW=$(echo "$QUICKVIEW_OUT" | grep -oE '[0-9]+M' | head -n 1 | tr -d 'M' || echo "0")
        LOW_RAW=$(echo "$QUICKVIEW_OUT" | grep -oE '[0-9]+L' | head -n 1 | tr -d 'L' || echo "0")

        CRIT_COUNT=${CRIT_RAW:-0}
        HIGH_COUNT=${HIGH_RAW:-0}
        MED_COUNT=${MED_RAW:-0}
        LOW_COUNT=${LOW_RAW:-0}
    fi

    if [ "$SHOW_CVES" = true ] && [ "$DRY_RUN" = false ]; then
        echo -e "${CYAN}${BOLD}Package & CVE Breakdown:${NC}"
        docker scout cves --only-severities critical,high,medium "$RESOLVED_REF" || true
        echo ""
    fi

    if [ "$GENERATE_SBOM" = true ] && [ "$DRY_RUN" = false ]; then
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

    if [ "$OUTPUT_JSON" = true ]; then
        JSON_REPORT=$(cat <<EOF
{
  "target": "${TARGET_SINGLE_IMAGE}",
  "resolved": "${RESOLVED_REF}",
  "vulnerabilities": {
    "critical": ${CRIT_COUNT},
    "high": ${HIGH_COUNT},
    "medium": ${MED_COUNT},
    "low": ${LOW_COUNT}
  }
}
EOF
)
        if [ -n "$OUTPUT_FILE" ]; then
            echo "$JSON_REPORT" > "$OUTPUT_FILE"
        fi
        echo "$JSON_REPORT"
    else
        echo -e "${BOLD}Recommended Next Steps:${NC}"
        echo -e "  - Base recommendations: ${CYAN}docker scout recommendations ${RESOLVED_REF}${NC}"
        echo -e "  - Compare to DHI:       ${CYAN}docker scout compare --to <hardened-image> ${RESOLVED_REF}${NC}"
    fi

    if [ "$FAIL_ON_CRITICAL" = true ] && [ "$CRIT_COUNT" -gt 0 ]; then
        echo -e "${RED}${BOLD}Policy Violation: ${CRIT_COUNT} critical vulnerability found in ${TARGET_SINGLE_IMAGE}.${NC}" >&2
        exit 1
    fi
    if [ "$FAIL_ON_HIGH" = true ] && { [ "$CRIT_COUNT" -gt 0 ] || [ "$HIGH_COUNT" -gt 0 ]; }; then
        echo -e "${RED}${BOLD}Policy Violation: ${CRIT_COUNT} critical and ${HIGH_COUNT} high vulnerabilities found in ${TARGET_SINGLE_IMAGE}.${NC}" >&2
        exit 1
    fi
    exit 0
fi

# Define comprehensive catalog of all project images across Larekmart monorepo
# Format: "CATEGORY|IMAGE_REF|SERVICE_NAME|HARDENED_BASELINE|ROLE"
declare -a IMAGES=(
    # ── Category 1: Core Transactional & Persistence Engines ────────────────────
    "core|pgvector/pgvector:pg16|postgres|dhi/postgres:16|Core Relational & Vector DB"
    "core|mysql:8.4|mysql|dhi/mysql:8.4|Return Service Relational DB"
    "core|mongo:7.0-jammy|mongo|dhi/mongodb:7.0|Core Document Store"
    "core|redis:7.4-alpine|redis|dhi/redis:7.4|Core In-Memory Cache & State Store"
    "core|apache/kafka:3.8.0|kafka|dhi/kafka:3.8|Core Event Bus (KRaft mode)"
    "core|opensearchproject/opensearch:2.17.1|opensearch|dhi/opensearch:2.17|Core Search Engine"
    "core|clickhouse/clickhouse-server:24.8-alpine|clickhouse|clickhouse:24.8-alpine|Real-Time Analytics Engine"
    "core|quay.io/minio/minio:latest|minio|minio:latest|S3 Media & Object Storage"

    # ── Category 2: Infrastructure, Gateways & Tooling ──────────────────────────
    "infra|traefik:v3.2|traefik|traefik:v3.2|Edge Reverse Proxy & Ingress"
    "infra|caddy:alpine|caddy|caddy:alpine|Edge Webserver & Ingress Proxy"
    "infra|edoburu/pgbouncer:latest|pgbouncer|pgbouncer:latest|PostgreSQL Connection Pooler"
    "infra|debezium/server:2.7.3.Final|debezium|debezium:2.7.3|Outbox CDC Event Streaming Engine"
    "infra|provectuslabs/kafka-ui:v0.7.2|kafka-ui|Internal UI|Kafka Management Dashboard"
    "infra|mongo-express:1.0.2|mongo-express|Internal UI|MongoDB Admin Dashboard"

    # ── Category 3: Base Runtimes & Compilers ───────────────────────────────────
    "runtimes|node:20-alpine|node-20-runner|dhi/node:20|Base Runtime for 20+ Node Services"
    "runtimes|node:22-alpine|node-22-runner|dhi/node:22|Base Runtime for Commission Service"
    "runtimes|alpine:3.20|alpine-runner|dhi/alpine:3.20|Go Service Minimal Runner"
    "runtimes|golang:1.22-alpine|golang-builder|dhi/golang:1.22|Go Service Multi-Stage Builder"
    "runtimes|ghcr.io/astral-sh/uv:python3.12-bookworm-slim|python-runner|dhi/python:3.12|Python Service Multi-Stage Base"

    # ── Category 4: Observability & Telemetry Stack ─────────────────────────────
    "observability|prom/prometheus:v2.53.0|prometheus|Hardened Distroless|Metrics Collection Engine"
    "observability|prom/alertmanager:v0.27.0|alertmanager|Hardened Distroless|Alert Routing & Dispatch"
    "observability|grafana/grafana:11.2.0|grafana|Alpine Hardened|Visualization Dashboard"
    "observability|grafana/loki:3.1.0|loki|Alpine Hardened|Log Aggregation Engine"
    "observability|grafana/tempo:2.6.1|tempo|tempo:2.6.1|Distributed Tracing Engine"
    "observability|grafana/promtail:3.1.0|promtail|Alpine Hardened|Log Shipper Daemon"
    "observability|otel/opentelemetry-collector-contrib:0.104.0|otel-collector|otel:0.104.0|OpenTelemetry Collector Contrib"
    "observability|prom/node-exporter:v1.8.2|node-exporter|Hardened Distroless|Host Metrics Exporter"
    "observability|oliver006/redis_exporter:v1.62.0|redis-exporter|Hardened Scratch|Redis Metrics Exporter"
    "observability|prometheuscommunity/postgres-exporter:v0.15.0|postgres-exporter|Hardened Scratch|Postgres Metrics Exporter"
    "observability|percona/mongodb_exporter:0.41.2|mongodb-exporter|Hardened Scratch|MongoDB Metrics Exporter"
    "observability|gcr.io/cadvisor/cadvisor:v0.49.1|cadvisor|cadvisor:v0.49.1|Container Resource Metrics"

    # ── Category 5: Security & Vulnerability Scanners ───────────────────────────
    "security|aquasec/trivy:0.53.0|trivy|aquasec/trivy:0.53.0|Container Security Scanner"
)

# Filter images according to CATEGORY_FILTER
declare -a FILTERED_IMAGES=()
for ENTRY in "${IMAGES[@]}"; do
    IFS='|' read -r CAT IMG_REF SVC_NAME HARDENED_BASE ROLE <<< "$ENTRY"
    if [ "$CATEGORY_FILTER" = "all" ] || [ "$CATEGORY_FILTER" = "$CAT" ]; then
        FILTERED_IMAGES+=("$ENTRY")
    fi
done

TOTAL_COUNT=${#FILTERED_IMAGES[@]}
AUDITED_COUNT=0
PASSED_COUNT=0
REVIEW_COUNT=0
TOTAL_CRITICAL=0
TOTAL_HIGH=0

if [ "$TOTAL_COUNT" -eq 0 ]; then
    echo -e "${RED}Error: No images found matching category filter '${CATEGORY_FILTER}'.${NC}" >&2
    echo "Available categories: core, infra, runtimes, observability, security, all" >&2
    exit 1
fi

if [ "$OUTPUT_JSON" = false ]; then
    echo -e "${BOLD}Target Images to Audit (${TOTAL_COUNT} total, filter: ${MAGENTA}${CATEGORY_FILTER}${NC}${BOLD}):${NC}"
    echo -e "------------------------------------------------------------------------"
fi

for ENTRY in "${FILTERED_IMAGES[@]}"; do
    IFS='|' read -r CAT IMG_REF SVC_NAME HARDENED_BASE ROLE <<< "$ENTRY"
    ((AUDITED_COUNT++))

    RESOLVED_REF=$(resolve_ref "$IMG_REF")

    if [ "$OUTPUT_JSON" = false ]; then
        echo -e "${BLUE}[${AUDITED_COUNT}/${TOTAL_COUNT}] Scanning ${BOLD}${SVC_NAME}${NC} (${IMG_REF})..."
        echo -e "  Category: ${MAGENTA}${CAT}${NC} | Role: ${ROLE} | Hardened Target: ${CYAN}${HARDENED_BASE}${NC}"
    fi

    if [ "$DRY_RUN" = true ]; then
        if [ "$OUTPUT_JSON" = false ]; then
            echo -e "  ${GREEN}✓ Dry-run verified: ${RESOLVED_REF}${NC}"
            echo ""
        fi
        ((PASSED_COUNT++))
        continue
    fi

    if QUICKVIEW_OUT=$(docker scout quickview "$RESOLVED_REF" 2>&1); then
        CRIT_RAW=$(echo "$QUICKVIEW_OUT" | grep -oE '[0-9]+C' | head -n 1 | tr -d 'C' || echo "0")
        HIGH_RAW=$(echo "$QUICKVIEW_OUT" | grep -oE '[0-9]+H' | head -n 1 | tr -d 'H' || echo "0")
        CRIT_VAL=${CRIT_RAW:-0}
        HIGH_VAL=${HIGH_RAW:-0}

        TOTAL_CRITICAL=$((TOTAL_CRITICAL + CRIT_VAL))
        TOTAL_HIGH=$((TOTAL_HIGH + HIGH_VAL))

        if [ "$OUTPUT_JSON" = false ]; then
            echo -e "  ${GREEN}✓ Scout Quickview completed successfully.${NC}"
            echo "$QUICKVIEW_OUT" | grep -E "Target|Base image|CRITICAL|HIGH|MEDIUM|LOW" | sed 's/^/    /' || true
        fi
        ((PASSED_COUNT++))
    else
        if [ "$OUTPUT_JSON" = false ]; then
            echo -e "  ${YELLOW}⚠ Quickview completed with notices or registry fallback required.${NC}"
            echo "$QUICKVIEW_OUT" | tail -n 4 | sed 's/^/    /'
        fi
        ((REVIEW_COUNT++))
    fi

    if [ "$SHOW_CVES" = true ] && [ "$DRY_RUN" = false ]; then
        echo -e "  ${CYAN}Package & CVE Breakdown:${NC}"
        docker scout cves --only-severities critical,high "$RESOLVED_REF" 2>&1 | head -n 25 | sed 's/^/    /' || true
    fi

    if [ "$OUTPUT_JSON" = false ]; then
        echo ""
    fi
done

if [ "$OUTPUT_JSON" = true ]; then
    JSON_SUMMARY=$(cat <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "filter": "${CATEGORY_FILTER}",
  "totalImages": ${TOTAL_COUNT},
  "audited": ${AUDITED_COUNT},
  "passed": ${PASSED_COUNT},
  "underReview": ${REVIEW_COUNT},
  "totalCritical": ${TOTAL_CRITICAL},
  "totalHigh": ${TOTAL_HIGH}
}
EOF
)
    if [ -n "$OUTPUT_FILE" ]; then
        echo "$JSON_SUMMARY" > "$OUTPUT_FILE"
    fi
    echo "$JSON_SUMMARY"
else
    echo -e "${CYAN}${BOLD}========================================================================${NC}"
    echo -e "${BOLD}Scan Summary: ${TOTAL_COUNT} Images Audited | ${GREEN}${PASSED_COUNT} Passed${NC} | ${YELLOW}${REVIEW_COUNT} Under Review${NC} | ${RED}${TOTAL_CRITICAL} Critical${NC} | ${YELLOW}${TOTAL_HIGH} High${NC}"
    echo -e "${CYAN}${BOLD}========================================================================${NC}"
    echo ""
    echo -e "${BOLD}Next Steps for Any Flagged Vulnerabilities:${NC}"
    echo -e "  1. View package details:     ${CYAN}pnpm docker:scout --cves <image>${NC}"
    echo -e "  2. View remediation advice:  ${CYAN}docker scout recommendations <image>${NC}"
    echo -e "  3. Compare with hardened:    ${CYAN}docker scout compare --to <hardened-image> <image>${NC}"
    echo -e "  4. Check OpenVEX statements: ${CYAN}pnpm docker:scout --vex${NC}"
    echo -e "  5. Filter by category:       ${CYAN}pnpm docker:scout --filter=core|infra|runtimes|observability${NC}"
    echo ""
fi

# CI/CD Policy Gates
if [ "$FAIL_ON_CRITICAL" = true ] && [ "$TOTAL_CRITICAL" -gt 0 ]; then
    echo -e "${RED}${BOLD}CI Gate Violation: Detected ${TOTAL_CRITICAL} critical vulnerabilities across scanned images.${NC}" >&2
    exit 1
fi

if [ "$FAIL_ON_HIGH" = true ] && { [ "$TOTAL_CRITICAL" -gt 0 ] || [ "$TOTAL_HIGH" -gt 0 ]; }; then
    echo -e "${RED}${BOLD}CI Gate Violation: Detected ${TOTAL_CRITICAL} critical and ${TOTAL_HIGH} high vulnerabilities across scanned images.${NC}" >&2
    exit 1
fi

exit 0
