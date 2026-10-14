# Larekmart Observability & Telemetry Configuration

This directory contains configuration files, alert rules, and dashboards for the Larekmart observability stack.

> **Note**: The YAML and JSON files in this directory (`prometheus.yml`, `alerts.yml`, `alertmanager.yml`, `dashboards/*.json`, `loki.yml`, `promtail.yml`) are **application configuration files** for telemetry daemons, not raw Kubernetes API manifests. Do not pass them directly to `kubectl apply -f`.

---

## Directory Overview

- **`alertmanager/alertmanager.yml`**: Routing, inhibition rules, and Slack/PagerDuty notification receivers for cluster alerts.
- **`prometheus/prometheus.yml`**: Scrape targets and scrape intervals for all 16 microservices, backing datastores (PostgreSQL, MongoDB, Redis, Kafka, OpenSearch), and system exporters.
- **`prometheus/rules/alerts.yml`**: Production alert definitions covering service downtime (`ServiceDown`), 5xx error spikes (`HighErrorRate`), p99 latency (`HighLatencyP99`), pod crash loops, resource saturation, and Kafka lag.
- **`grafana/dashboards/`**: Pre-built Grafana JSON dashboards (`infrastructure.json`, `service-health.json`).
- **`grafana/provisioning/`**: Automated datasource and dashboard provider configurations.
- **`loki/loki.yml`**: Loki log storage and chunk engine configuration.
- **`promtail/promtail.yml`**: Log scraper and Docker log pipeline configurations.

---

## How to Run

### 1. Docker Compose (Local Observability Stack)

Start the full observability ecosystem locally with a single command:

```bash
docker compose -f docker-compose.observability.yml up -d
```

Access services locally:
- **Grafana**: http://localhost:3001 (Credentials: `admin` / `admin`)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Loki**: http://localhost:3100

---

### 2. Kubernetes Deployment (Production & Staging)

For Kubernetes environments, deploy the industry-standard `kube-prometheus-stack` Helm chart and inject these configurations into ConfigMaps:

```bash
# 1. Add Prometheus Community Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 2. Deploy kube-prometheus-stack in the monitoring namespace
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# 3. Mount custom Prometheus alert rules as a PrometheusRule or ConfigMap:
kubectl create configmap prometheus-rules \
  --namespace monitoring \
  --from-file=alerts.yml=infrastructure/observability/prometheus/rules/alerts.yml
```

Larekmart's Kubernetes `NetworkPolicy` allows traffic from the `monitoring` namespace to all microservices on their metrics ports (e.g. `allow-prometheus-scrape`).
