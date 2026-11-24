# Enterprise DevSecOps Architecture, Compliance & Governance — Larekmart

This document defines the comprehensive **Enterprise DevSecOps Architecture, Compliance Framework, and Security Governance Blueprint** for the Larekmart microservices platform.

---

## 1. DevSecOps Architecture & Zero-Trust Threat Model

Larekmart operates under a strict **Zero-Trust Security Architecture** ("never trust, always verify"). Every component, network boundary, container, and API interaction is continuously authenticated, authorized, and audited.

```text
                                    ┌────────────────────────┐
                                    │  Edge Perimeter (WAF)  │
                                    │ Cloudflare / AWS Shield │
                                    └───────────┬────────────┘
                                                │ HTTPS / TLS 1.3 (HSTS)
                                                ▼
                                    ┌────────────────────────┐
                                    │ Ingress Controller     │
                                    │ NGINX Ingress + TLS SNI│
                                    └───────────┬────────────┘
                                                │ Strips untrusted headers
                                                ▼
                                    ┌────────────────────────┐
                                    │ API Gateway (Port 8080)│
                                    │ Auth / Rate Limit / OTel
                                    └───────────┬────────────┘
                         mTLS / Isolated Network│Policies
              ┌─────────────────────────────────┼─────────────────────────────────┐
              ▼                                 ▼                                 ▼
   ┌──────────────────────┐          ┌──────────────────────┐          ┌──────────────────────┐
   │ Customer Storefront  │          │ Tier-1 Core Services │          │ Asynchronous Workers │
   │ Next.js 16 (Port 3002)│         │ Order / Cart / Stock │          │ Email / Kafka Worker │
   └──────────────────────┘          └──────────┬───────────┘          └──────────┬───────────┘
                                                │                                 │
                                                ▼                                 ▼
                                    ┌────────────────────────┐         ┌──────────────────────┐
                                    │   Stateful Data Tier   │         │ Kafka Event Cluster  │
                                    │ PgBouncer / Mongo / RDS│         │ SASL/SCRAM + TLS     │
                                    └────────────────────────┘         └──────────────────────┘
```

### Core Threat Boundaries & Defense-in-Depth

1. **Edge Boundary**: DDoS mitigation, bot detection, WAF rules, and TLS 1.3 termination.
2. **Ingress Boundary**: Rate limiting, strict CORS allowlists, header sanitization, and request body size enforcement (5MB max).
3. **Gateway Boundary**: Cryptographic Clerk JWT RS256 token verification, constant-time internal secret validation, and untrusted header stripping.
4. **Service Boundary**: Zero inter-service synchronous HTTP calls; strictly asynchronous Kafka event streaming with transactional outbox.
5. **Runtime Boundary**: Pod Security Standards (Restricted), read-only root filesystems, non-root execution (UID 1000), and Falco eBPF syscall intrusion detection.
6. **Data Boundary**: Parameterized queries, double-entry financial ledgers, encrypted persistent volumes (KMS), and physical isolation of Tier-1 databases.

---

## 2. Shift-Left Security Pipeline (CI/CD DevSecOps)

The automated GitHub Actions DevSecOps workflow (`.github/workflows/devsecops-pipeline.yml`) enforces multi-layered shift-left security checks on every pull request and commit:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           Automated Enterprise DevSecOps Pipeline                               │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────────────┤
│ 1. Secret    │ 2. SAST Code │ 3. SCA Deps  │ 4. IaC Scan  │ 5. DAST Run  │ 6. Container & SBOM  │
│    Detection │    Analysis  │    & Audit   │    & Config  │    Perimeter │    & Cosign Signing  │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────────────┤
│ Gitleaks &   │ Semgrep OSS  │ Snyk Code &  │ Trivy Config │ API Gateway  │ Syft CycloneDX SBOM  │
│ Trivy Secret │ Ruleset      │ pnpm audit   │ (K8s/Terra)  │ OWASP Top 10 │ Trivy Image + Cosign │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────────────┘
```

1. **Secret Scanning**: Scans entire git history with Gitleaks and Trivy to prevent API keys, tokens, or private certificates from entering git.
2. **Static Application Security Testing (SAST)**: Runs Semgrep rulesets targeting OWASP Top 10 vulnerabilities across TypeScript, JavaScript, Go, and Python.
3. **Software Composition Analysis (SCA)**: Validates third-party packages against CVE databases using `pnpm audit` and Snyk.
4. **Infrastructure as Code (IaC) Scanning**: Inspects Terraform modules, Helm charts, and Kubernetes manifests for security misconfigurations using Trivy config scanners.
5. **Dynamic Application Security Testing (DAST)**: Executes `pnpm test:dast` against the API Gateway perimeter to verify resistance against BOLA, mass assignment, injection, SSRF, and rate limiting bypasses.
6. **SBOM Generation & Cosign Signing**: Generates CycloneDX software bills of materials via Syft and signs container images with keyless OIDC Cosign attestations.

---

## 3. Container & Kubernetes Hardening

### Pod Security Standards (PSS Restricted)

The `larekmart` namespace strictly enforces the Kubernetes `restricted` PSS profile via admission controllers:

- `pod-security.kubernetes.io/enforce: restricted`
- `pod-security.kubernetes.io/audit: restricted`
- `pod-security.kubernetes.io/warn: restricted`

### Container Hardening Standards

- **Non-Root Execution**: `runAsNonRoot: true`, `runAsUser: 1000`, `runAsGroup: 1000`.
- **Capability Dropping**: `capabilities.drop: ["ALL"]`.
- **Read-Only Root Filesystem**: `readOnlyRootFilesystem: true` with ephemeral `emptyDir` volumes mounted only for `/tmp` with explicit `sizeLimit: 128Mi`.
- **Privilege Escalation**: `allowPrivilegeEscalation: false`.
- **Seccomp Profile**: `seccompProfile.type: RuntimeDefault`.

### Kyverno Admission Controller Enforcement

Automated admission policies (`infrastructure/kubernetes/base/security/kyverno-policies.yaml`) block non-compliant workloads:

- Disallows privileged containers.
- Rejects unpinned `:latest` container tags in production.
- Mandates CPU and memory resource requests and limits.
- Blocks host namespace sharing (`hostPID`, `hostIPC`, `hostNetwork`).

### Zero-Trust Network Policies

Default-deny network policies (`infrastructure/kubernetes/base/network-policies/network-policies.yaml`) enforce strict traffic segregation:

- **Default Deny**: All pod ingress and egress blocked by default.
- **Edge Segregation**: Ingress controller can only reach frontends and API Gateway.
- **Backend Isolation**: Backend microservices only accept incoming connections from the API Gateway.
- **Metadata Protection**: Egress explicitly blocks `169.254.169.254/32` to prevent Server-Side Request Forgery (SSRF) to cloud instance metadata services.

---

## 4. Secrets & Identity Management

### HashiCorp Vault & External Secrets Operator

- **Zero Plaintext Secrets**: Secrets are never committed to version control. `secret-templates.yaml` contains placeholder references only.
- **External Secrets Operator (ESO)**: Connects to HashiCorp Vault (`ClusterSecretStore`) or AWS Secrets Manager (`SecretStore`) via Kubernetes Workload Identity / IRSA.
- **Dynamic Secret Rotation**: Database credentials and Stripe keys are synced dynamically into ephemeral Kubernetes Secrets with automatic TTL rotation.
- **Least-Privilege Workload Identity**: Pods mount service accounts with `automountServiceAccountToken: false` to eliminate token leakage and unauthorized Kubernetes API access.

---

## 5. Runtime Security & SIEM Observability

### Falco eBPF Intrusion Detection

Falco runs as a DaemonSet (`infrastructure/observability/falco/falco-daemonset.yaml`) monitoring kernel syscalls:

- **Interactive Shell Spawn**: Alerts immediately if `sh`, `bash`, or `zsh` executes inside production microservice containers.
- **Binary Directory Modifications**: Alerts on unauthorized writes to `/bin`, `/sbin`, or `/usr/bin`.
- **Metadata Probing**: Triggers critical alerts if any container attempts outbound connections to `169.254.169.254`.
- **Sensitive File Reads**: Detects unauthorized reading of `.pem`, `.key`, or `/etc/shadow` files.

### Centralized Logging & Audit Trails

- **Loki & Promtail**: Centralized log streaming with 31-day retention and chunk compression.
- **Zero Credential Leakage**: HTTP interceptors automatically redact `Authorization`, `Cookie`, `x-internal-secret`, and customer payment card details from logs.
- **Audit Trails**: Critical security events (login failures, admin privilege delegations, payout approvals, KYB document uploads) are published to immutable append-only Kafka audit topics (`audit.security.events`).

---

## 6. Compliance Frameworks & Governance Controls

Larekmart's DevSecOps controls map directly to major industry compliance frameworks:

| Compliance Framework | Requirement                           | Larekmart Implementation & Control                                                                                      |
| :------------------- | :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| **SOC 2 Type II**    | CC6.1 - Logical Access Controls       | Clerk RS256 token verification, perimeter identity header stripping, RBAC route guards (`shouldBeAdmin`).               |
| **SOC 2 Type II**    | CC6.6 - Boundary Protection           | Zero-Trust Network Policies, API Gateway reverse proxy, WAF rate limiting, SSRF metadata egress block.                  |
| **SOC 2 Type II**    | CC6.7 - Data Transmission Encryption  | TLS 1.3 in transit, HSTS enforced, Kafka SASL/SCRAM + TLS internal streaming.                                           |
| **SOC 2 Type II**    | CC7.2 - Intrusion Monitoring          | Falco eBPF runtime sensor, Prometheus security threat alerts, Grafana SIEM dashboards.                                  |
| **ISO/IEC 27001**    | A.8.24 - Cryptography                 | RS256 JWT validation, SHA-256 HMAC quote tokens, timing-safe comparisons (`crypto.timingSafeEqual`).                    |
| **ISO/IEC 27001**    | A.8.28 - Secure Coding                | Automated SAST (Semgrep), DAST (`pnpm test:dast`), 100% parameterized SQL queries, zero raw string interpolations.      |
| **GDPR**             | Article 32 - Security of Processing   | Anonymized user telemetry, PII redaction in logs, cryptographic pseudonymization of analytics events.                   |
| **GDPR**             | Article 17 - Right to Erasure         | User deletion saga in `user-service` cascade-anonymizes personal profiles while maintaining financial audit invariants. |
| **CIS Kubernetes**   | 5.2.1 - Minimize Privileged Pods      | Pod Security Standards `restricted` enforced, Kyverno admission blocking root containers.                               |
| **CIS Kubernetes**   | 5.1.3 - Service Account Token Leakage | `automountServiceAccountToken: false` set on all workload service accounts.                                             |

---

## 7. Incident Response Plan & Security Runbooks

### Incident Severity Levels

- **SEV-1 (Critical Breach / Active Exploitation)**: Customer PII exposed, authentication bypassed, financial ledger compromised, remote code execution. Immediate containment within 15 minutes.
- **SEV-2 (High Risk / Degraded Control)**: WAF bypass detected, elevated 401/403 attack volume, Falco shell detection alert. Response within 1 hour.
- **SEV-3 (Moderate / Vulnerability Discovered)**: High-severity CVE in dependencies, misconfigured security header, automated scanning alert. Remediation within 24 hours.

### SEV-1 Incident Response Workflow

```text
1. DETECTION ──▶ 2. TRIAGE & ISOLATE ──▶ 3. CONTAINMENT ──▶ 4. REMEDIATION ──▶ 5. POST-MORTEM
   Falco /          Verify alert;          Trigger WAF IP      Deploy hotfix;     Produce RCA report;
   Prometheus /     isolate pod via        block; revoke       rotate secrets;    update regression
   DAST alert       NetworkPolicy          Clerk sessions      verify with DAST   test suite
```

1. **Isolation**: Quarantine compromised pods by applying a network policy removing all ingress and egress permissions.
2. **Credential Invalidation**: Rotate `INTERNAL_SERVICE_SECRET`, database credentials, and invalidate active Clerk sessions via the administrative API.
3. **Forensic Analysis**: Export Falco eBPF syscall logs and Loki audit traces preserving timestamps and IP provenance.
4. **Hotfix & DAST Verification**: Apply security patch, run `pnpm test:dast`, and deploy via automated GitHub Actions pipeline.
5. **Post-Mortem**: Document root cause, timeline, affected records, and implement automated regression tests.

---

## 8. Disaster Recovery & Business Continuity (BC/DR)

### Service Level Objectives

- **Recovery Point Objective (RPO)**: < 5 minutes for Tier-1 transactional ledgers (`inventory_db`, `pricing_db`, `payout_db`, `order_db`).
- **Recovery Time Objective (RTO)**: < 30 minutes for checkout plane restoration; < 2 hours for full platform restoration.

### Automated Backup & Restore Protocols

```bash
# 1. Tier-1 PostgreSQL Isolated Backups
for DB in inventory_db pricing_db payout_db; do
  pg_dump -h pgbouncer -p 6432 -U postgres -d "${DB}" -Fc -Z 6 -f "/var/backups/${DB}-$(date +%Y%m%d%H%M).dump"
done

# 2. MongoDB Hashed-Sharded Orders Backup
mongodump --uri="mongodb://root:example@mongo:27017/order_db?authSource=admin" --archive="/var/backups/order_db-$(date +%Y%m%d%H%M).archive" --gzip

# 3. Restoration Verification
pg_restore -h target-host -p 5432 -U postgres -d inventory_db --clean --if-exists -j 4 /var/backups/inventory_db-latest.dump
pnpm db:status
```

All backups are encrypted at rest with AES-256 via customer-managed KMS keys and replicated cross-region to secondary disaster recovery cloud buckets.
