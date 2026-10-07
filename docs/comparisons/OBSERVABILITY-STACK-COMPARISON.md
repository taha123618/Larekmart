# Observability & Logging Architecture Evaluation
## Dozzle vs. Rootprint vs. CNCF Prometheus / Grafana / Loki / Alertmanager

This document provides the definitive architectural comparison and operational guide for the three logging and observability stacks available in the **Larekmart** microservices repository.

---

## 1. Executive Summary & The Definitive Verdict

For **Larekmart**—a production-grade distributed e-commerce platform designed to operate at Amazon/AliExpress scale with 15 microservices, asynchronous Kafka messaging, and multi-database persistence—the clear winner for the core production standard is:

### 🏆 The Winner: **CNCF Prometheus + Grafana + Alertmanager + Loki + Promtail Stack**
*(Configured in `docker-compose.observability.yml`)*

### Why?
1. **Full-Spectrum Telemetry (Metrics + Logs + Traces + Alerts):** Neither Dozzle nor Rootprint can collect infrastructure, application, or database metrics (CPU, RAM, latency percentiles p95/p99, database connection pool exhaustion, Kafka consumer lag). Prometheus provides this out-of-the-box.
2. **Unified Single Pane of Glass:** Grafana correlates metrics spikes directly with Loki container logs in the same UI window at the exact second an anomaly occurs.
3. **Proactive Alerting:** Alertmanager dispatches notifications to Slack, PagerDuty, or Webhooks when error rates spike or brokers fail. Neither Dozzle nor Rootprint has automated alerting.
4. **Cloud-Native Industry Standard:** Fully compatible with Kubernetes (EKS, GKE, AKS), Prometheus Operator, and OpenTelemetry standards.

---

## 2. Feature & Capability Matrix

| Feature / Requirement | **Dozzle** (`:8085` / `:8888`) | **Rootprint** (`:8282`) | **Prometheus + Grafana + Loki** (`:3001` / `:9090`) |
| :--- | :---: | :---: | :---: |
| **Primary Architectural Role** | Ephemeral Live Log Streamer | Distributed Log Search Indexer | Full Telemetry, Metrics, Logs & Alerting |
| **System & Host Metrics** (CPU, RAM, Disk, Net) | ❌ No | ❌ No | **✅ Yes (Node Exporter)** |
| **Database & Broker Metrics** (Kafka lag, PG, Mongo, Redis) | ❌ No | ❌ No | **✅ Yes (4 Specialized Exporters)** |
| **HTTP Error Rates & p95/p99 Latency** | ❌ No | ❌ No | **✅ Yes (Prometheus TSDB)** |
| **Log Ingestion & Aggregation** | ⚠️ Live stream only | ✅ Yes (Quickwit) | **✅ Yes (Promtail + Loki)** |
| **Historical Log Retention** | ❌ None (lost on restart) | ✅ Persistent (MinIO S3) | **✅ Persistent (Loki TSDB chunks)** |
| **Metrics-to-Logs Correlation** | ❌ No | ❌ No | **✅ Yes (Direct in Grafana)** |
| **Proactive Alerting Rules** | ❌ No | ❌ No | **✅ Yes (Alertmanager)** |
| **Memory / Footprint** | **~20 MB RAM** (ultra-light) | ~500 MB – 1 GB RAM | ~600 MB – 1.2 GB RAM |
| **Security Risk (`/var/run/docker.sock`)** | ⚠️ Direct mount required | 🛡️ Ingests over network | 🛡️ Promtail reads log paths |
| **Best Operational Fit** | **Local Dev Inner Loop** | **Deep S3 Log Forensics** | **Staging & Production SRE** |

---

## 3. Deep-Dive: The Three Stacks Explained

### Stack A: Dozzle (`docker-compose.dozzle.yml`)
- **How it works:** Mounts `/var/run/docker.sock:ro` and tails standard output (`stdout`) and standard error (`stderr`) streams directly from active Docker containers using Server-Sent Events (SSE).
- **Fronted by:** Nginx on port `8085` (`docker/nginx/nginx.conf`) with a 100M payload buffer.
- **Strengths:**
  - Starts in 1 second.
  - Consumes virtually zero memory (~20 MB RAM).
  - Requires no database, no storage volumes, and no configuration.
- **Weaknesses:**
  - Ephemeral only: When a container crashes (OOMKilled) or restarts, its historical logs vanish.
  - Unsafe for production: Exposing Docker socket in cloud environments violates container security standards.
- **When to use:** Daily local development on your workstation to view real-time logs without opening 15 terminal windows.

### Stack B: Rootprint (`docker-compose.rootprint.yml`)
- **How it works:** Full-featured log search platform backed by **Quickwit v0.9.0** (a cloud-native distributed search engine written in Rust), **MinIO** (S3-compatible object storage), and **PostgreSQL 17** (metadata).
- **Strengths:**
  - Extremely cheap long-term storage: Indexes logs directly to MinIO (or AWS S3) instead of memory-heavy Elasticsearch JVM heaps.
  - Sub-second distributed search across millions of historical log entries.
  - Ideal for cross-service request tracing (`correlationId`) across days or weeks.
- **Weaknesses:**
  - Medium resource footprint (spins up MinIO, Quickwit, Postgres, and Rootprint).
  - Dedicated exclusively to logs—cannot monitor system metrics, CPU spikes, or Kafka lag.
- **When to use:** Incident post-mortems, compliance audit trails, and deep log forensics on staging/cloud clusters.

### Stack C: CNCF Observability Stack (`docker-compose.observability.yml`)
- **How it works:**
  - **Prometheus (v2.53.0):** Pulls metrics from all 15 microservices and infrastructure exporters every 15 seconds.
  - **Node Exporter & DB Exporters:** Scrapes Redis (9121), PostgreSQL (9187), MongoDB (9216), Kafka, and host OS (9100).
  - **Loki & Promtail (v3.1.0):** Shiphers and indexes container logs using label-based indexing (LogQL).
  - **Grafana (v11.2.0):** Unified dashboards visualizing metrics, logs, and alerts in one interface.
  - **Alertmanager (v0.27.0):** Groups, silences, and routes critical alerts to notification channels.
- **Strengths:**
  - Complete visibility into health, performance, saturation, and errors.
  - Traces Kafka queue lag before messages fail or back up.
  - Pre-configured production alert rules (`ServiceDown`, `HighErrorRate`, `HighLatencyP99`, `KafkaBrokerDown`).
- **When to use:** Core production operations, staging performance verification, and SRE monitoring.

---

## 4. Architectural Coexistence: How to Use Them Together

The three stacks are designed to complement each other across the software development lifecycle:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WHERE EACH TOOL BELONGS                                │
├──────────────────────────┬──────────────────────────────────────────────────┤
│ 1. Local Laptop Dev      │ DOZZLE (docker-compose.dozzle.yml)               │
│    (Inner Dev Loop)      │ • Near-zero RAM (~20MB)                          │
│                          │ • Opens in 1s to view live container logs        │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 2. Deep S3 Log Archives  │ ROOTPRINT (docker-compose.rootprint.yml)         │
│    (Forensics)           │ • Quickwit full-text search on MinIO S3          │
│                          │ • Niche: cheap terabyte log search               │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 3. CORE ENTERPRISE STACK │ PROMETHEUS + GRAFANA + LOKI                      │
│    (Staging & Prod SRE)  │ (docker-compose.observability.yml)               │
│                          │ • Complete metrics, logs, alerts & dashboards    │
│                          │ • The undisputed industry standard               │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

---

## 5. Operations & Quick Commands

### Running Dozzle (Local Dev)
```bash
docker compose -f docker-compose.dozzle.yml up -d
# UI: http://localhost:8085 (or http://logs.localhost via Traefik)
```

### Running Rootprint (Log Analytics)
```bash
pnpm rootprint:up
# or: docker compose -f docker-compose.rootprint.yml up -d
# UI: http://localhost:8282 (Rootprint) | http://localhost:9001 (MinIO Console)
```

### Running Observability (Production SRE)
```bash
pnpm monitoring:up
# or: docker compose -f docker-compose.observability.yml up -d
# UI: http://localhost:3001 (Grafana - admin/grafana_admin_secret)
# UI: http://localhost:9090 (Prometheus)
# UI: http://localhost:9093 (Alertmanager)
```
