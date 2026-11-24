# DevSecOps Standards — Larekmart

## Metadata
```yaml
name: devsecops-standards
description: >
  Enterprise-grade DevSecOps standards for every feature, service, infrastructure
  change, or CI/CD pipeline update in Larekmart. Load this skill when adding new
  services, changing Docker configs, modifying Kubernetes manifests, updating GitHub
  Actions, touching auth/secrets, or reviewing security posture. Provides mandatory
  gates, hardening rules, and Definition of Done for all DevSecOps changes.
alwaysLoad: false
triggers:
  - docker
  - kubernetes
  - k8s
  - ci/cd
  - github actions
  - secrets
  - vault
  - security
  - authentication
  - authorization
  - rbac
  - network policy
  - ingress
  - tls
  - ssl
  - sast
  - dast
  - trivy
  - vulnerability scan
  - container hardening
  - pod security
  - zero trust
  - mtls
  - waf
  - rate limiting
  - sonarqube
  - snyk
  - owasp
  - falco
  - helm
  - terraform
  - kustomize
  - backup
  - disaster recovery
  - compliance
  - soc2
  - gdpr
  - iso27001
```

---

## 1. Security-First Development Principles

Every engineer and AI agent working in Larekmart **MUST** treat security as a first-class feature at every stage of development. Security is **never** an afterthought.

### 1.1 Zero-Trust Architecture Principles

- **Never trust the network**: All internal service communication must be authorized, even within the cluster.
- **Verify explicitly**: Every request validated via cryptographic tokens; no ambient trust.
- **Least privilege**: Every service, container, and K8s ServiceAccount gets the minimum permissions required.
- **Assume breach**: Design for detection and containment, not just prevention.

---

## 2. Secure Container Standards

### 2.1 Multi-Stage Dockerfile Requirements

Every `Dockerfile` in Larekmart **MUST** follow this pattern:

```dockerfile
# Stage 1: Base
FROM node:22-alpine AS base
WORKDIR /app

# Stage 2: Prune (turbo prune for Node.js monorepo)
FROM base AS pruner
RUN npm install -g turbo@2
COPY . .
RUN turbo prune --scope=<workspace> --docker

# Stage 3: Dependencies
FROM base AS deps
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --prod

# Stage 4: Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
RUN pnpm build

# Stage 5: Runner (minimal, non-root)
FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 appgroup \
    && adduser  --system --uid 1001 --ingroup appgroup appuser
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8000/health || exit 1
CMD ["node", "dist/index.js"]
```

### 2.2 Container Hardening Checklist

- [ ] Non-root user (`USER appuser` / `UID 1001`).
- [ ] Minimal base image: Alpine, distroless, or slim variants.
- [ ] No `COPY . .` in the final runner stage — only copy built artifacts.
- [ ] No secrets, credentials, or `.env` files in any image layer.
- [ ] Read-only filesystem where possible (`readOnlyRootFilesystem: true` in K8s).
- [ ] `HEALTHCHECK` instruction on every production image.
- [ ] Explicit, pinned base image tags — never `:latest` in production.
- [ ] `.dockerignore` excludes: `.git`, `node_modules`, `tests`, `coverage`, `*.env*`, `*.key`, `*.pem`.

### 2.3 Image Scanning Requirements

Every Docker image pushed to any registry **MUST** pass Trivy scanning:

```bash
# MUST pass with exit-code 1 on CRITICAL vulnerabilities
trivy image --exit-code 1 --severity CRITICAL ghcr.io/larekmart/<image>:sha-<commit>

# IaC scanning of Dockerfiles and K8s manifests
trivy config --exit-code 1 infrastructure/kubernetes/base/
trivy config --exit-code 1 infrastructure/mlops/docker/
```

---

## 3. Kubernetes Security Standards

### 3.1 Pod Security Standards (PSS)

All workloads **MUST** run under **Restricted** baseline or explicitly document why they cannot:

```yaml
# Every pod spec must include
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  fsGroup: 1001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  seccompProfile:
    type: RuntimeDefault
  capabilities:
    drop: ["ALL"]
```

### 3.2 RBAC Requirements

Every new service **MUST** have its own minimal `ServiceAccount`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: <service>-sa
  namespace: larekmart-production
automountServiceAccountToken: false   # ALWAYS false unless explicitly needed
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
# Grant ONLY the resources and verbs this service actually needs
```

**NEVER** use `cluster-admin`, `admin`, or `edit` ClusterRole bindings for application workloads.

### 3.3 Network Policies (Mandatory for every new service)

Add a `NetworkPolicy` for every new K8s workload in `infrastructure/kubernetes/base/<service>/`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: <service>-network-policy
spec:
  podSelector:
    matchLabels:
      app: <service>
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway   # only from API gateway
      ports:
        - port: 8000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres      # only to its own DB
      ports:
        - port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: kafka
      ports:
        - port: 9092
```

### 3.4 Resource Limits (Mandatory)

Every `Deployment` / `StatefulSet` / `Job` **MUST** declare resource requests **and** limits:

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "1"
    memory: "512Mi"
```

Base these on actual profiling — never guess or omit.

### 3.5 Health Probes (Mandatory)

```yaml
livenessProbe:
  httpGet: { path: /health, port: 8000 }
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet: { path: /health, port: 8000 }
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
startupProbe:
  httpGet: { path: /health, port: 8000 }
  failureThreshold: 30
  periodSeconds: 5
```

### 3.6 Pod Disruption Budgets (Mandatory for multi-replica deployments)

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: <service>
```

---

## 4. CI/CD Security Pipeline

### 4.1 GitHub Actions Security Gates (Mandatory workflow structure)

Every service's CI workflow **MUST** follow this stage order and **block on failure**:

```
1. Code Quality:   pnpm lint + pnpm format:check
2. Type Safety:    pnpm check-types
3. Unit Tests:     pnpm test (100% pass rate required)
4. SAST:           CodeQL / SonarQube scan
5. Dependency:     pnpm audit --audit-level=high + Trivy FS scan
6. DAST:           pnpm test:dast (all 8 OWASP phases)
7. Build:          Docker multi-arch build (--platform linux/amd64,linux/arm64)
8. Image Scan:     trivy image --exit-code 1 --severity CRITICAL
9. IaC Scan:       trivy config --exit-code 1 infrastructure/
10. Sign:          cosign sign (Sigstore transparency log)
11. Deploy:        Only if ALL gates above pass
```

### 4.2 Secret Scanning (Required on every PR)

```yaml
- name: Secret Scanning
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: ${{ github.event.repository.default_branch }}
    head: HEAD
    extra_args: --only-verified
```

### 4.3 Workflow Hardening Rules

```yaml
permissions:
  contents: read      # Principle of least privilege — only grant what's needed
  packages: write     # Only for image push jobs

# Pin ALL third-party Actions to a full SHA — never a branch or tag
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

- Never use `pull_request_target` with `${{ github.event.pull_request.head.sha }}`.
- Never store secrets in workflow `env:` blocks — use `${{ secrets.NAME }}` inline.
- Add `timeout-minutes` to every job to prevent runaway billing.
- Use `concurrency:` groups with `cancel-in-progress: true` to prevent duplicate runs.

---

## 5. Secrets Management

### 5.1 Hierarchy

```
Production:   HashiCorp Vault (via External Secrets Operator) → K8s Secrets
Staging:      Vault (dev namespace) → K8s Secrets
Development:  .env files (never committed) — only .env.example committed
CI/CD:        GitHub Actions encrypted secrets — NEVER inline in YAML
```

### 5.2 Rules

- **Zero hardcoded secrets** in any source file, test, comment, or Dockerfile.
- `.env.example` contains only placeholder values (`YOUR_API_KEY`, `changeme`).
- K8s `Secret` objects are never stored in git — use Sealed Secrets or ESO.
- Rotate: short-lived tokens preferred (< 24h TTL); long-lived credentials rotated quarterly.
- Audit: Every secret access logged via Vault audit backend.

### 5.3 Adding a New Secret

1. Add `YOUR_<SECRET_NAME>` placeholder to `.env.example`.
2. Add the secret to GitHub Actions secrets (via UI or `gh secret set`).
3. For K8s: create an `ExternalSecret` referencing the Vault path.
4. Never add the actual value to any file.
5. Update `docs/DEVSECOPS-RUNBOOKS.md` with the new secret's purpose and rotation schedule.

---

## 6. API Gateway Security (Mandatory for every new route)

When adding a new service route to `apps/api-gateway`:

### 6.1 Header Sanitization (Non-Negotiable)

The API gateway **MUST** unconditionally strip all client-supplied identity headers on ingress **before** forwarding:

```typescript
// In src/middleware/header-sanitizer.ts
const SANITIZED_HEADERS = [
  'x-user-id', 'x-user-role', 'x-session-claims',
  'x-internal-secret', 'x-admin',
];
// Delete every listed header from every incoming request — no exceptions
```

### 6.2 Route Authorization Matrix

| Route prefix | Required role | Notes |
|---|---|---|
| `/api/v1/admin/*` | `admin` | Never grant via transport secret |
| `/api/v1/internal/*` | Internal secret only | Service-to-service, never from browser |
| `/api/v1/*` | `user` or `customer` | Clerk JWT required |
| Public routes | None | Explicitly allowlisted in `public.routes.ts` |

### 6.3 Rate Limiting Requirements

Every new service route **MUST** have rate limits configured:

```typescript
{
  max: 100,           // requests per window
  timeWindow: 60000,  // 1 minute in ms
  keyPrefix: '<service>',
  // Key MUST derive from verified userId or trusted client IP — NEVER client-supplied header
}
```

Sensitive endpoints (auth, password reset, payment initiation): `max: 5, timeWindow: 60000`.

---

## 7. Application Security Checklist

### 7.1 Input Validation (Mandatory)

- All HTTP request bodies validated via Zod schemas (TypeScript) or Pydantic models (Python).
- Reject unknown properties (`strict()` in Zod, `model_config = ConfigDict(extra="forbid")` in Pydantic).
- Maximum body size enforced at gateway (5MB default, 25MB for media upload routes).
- No raw SQL string interpolation — use Prisma ORM, parameterized queries, or Mongoose.

### 7.2 Output Encoding (Mandatory)

- Never return raw stack traces or file paths in HTTP error responses.
- Use generic messages for auth failures (`"Unauthorized"` — never reveal why).
- Structured error format: `{ "message": "...", "code": "...", "requestId": "..." }`.
- Never log passwords, tokens, API keys, PII, or session cookies.

### 7.3 Security Response Headers (Mandatory on all HTTP responses)

```typescript
// Verify these headers are set in api-gateway/src/middleware/security-headers.ts
'X-Content-Type-Options': 'nosniff',
'X-Frame-Options': 'DENY',
'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
'Content-Security-Policy': "default-src 'self'",
'Referrer-Policy': 'strict-origin-when-cross-origin',
'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
'X-Request-Id': '<uuid>',   // correlation ID
```

### 7.4 CORS Configuration (Mandatory)

```typescript
// NEVER wildcard with credentials
origin: [process.env.CLIENT_URL, process.env.ADMIN_URL, process.env.SELLER_URL],
credentials: true,
// Reject all other origins — fail closed
```

---

## 8. DAST Requirements (8 Mandatory Test Phases)

The `pnpm test:dast` suite **MUST** cover all 8 OWASP API Security Top 10 phases. When adding a new feature or route, add corresponding DAST test cases to `apps/api-gateway/tests/security/dast-runner.ts`:

| Phase | What to test |
|---|---|
| DAST 1 | Perimeter header sanitization — strip `x-user-id`, `x-user-role`, etc. |
| DAST 2 | JWT forgery — `alg: none`, tampered HMAC, expired token, garbage strings |
| DAST 3 | Broken function-level auth (BFLA) — customer/seller blocked from admin routes |
| DAST 4 | Mass assignment — extra properties rejected or stripped |
| DAST 5 | Resource consumption — oversized payloads (413), concurrency bulkhead (503) |
| DAST 6 | Defensive security headers — verify all 7 required headers |
| DAST 7 | Injection resilience — SQLi payloads, path traversal, null bytes |
| DAST 8 | Error sanitization — zero credentials or paths in error responses |

---

## 9. Observability & Incident Response

### 9.1 Audit Logging Requirements

Every security-relevant event **MUST** be logged at `WARN` or `ERROR` with structured fields:

```typescript
logger.warn({ userId, url, reason, traceId }, 'Authorization failed');
logger.warn({ ip, endpoint, limit }, 'Rate limit exceeded');
logger.error({ error: 'Tampered token', alg, traceId }, 'Auth bypass attempt');
```

Never log: `password`, `token`, `Authorization`, `x-internal-secret`, `apiKey`, `creditCard`.

### 9.2 Security Alerting

Add to `infrastructure/observability/prometheus/rules/alerts.yml` for each new service:

```yaml
- alert: HighAuthFailureRate_<Service>
  expr: rate(http_requests_total{service="<service>",status="401"}[5m]) > 10
  for: 2m
  severity: warning
  annotations:
    runbook: docs/DEVSECOPS-RUNBOOKS.md#auth-failure-runbook

- alert: RateLimitBreached_<Service>
  expr: rate(http_requests_total{service="<service>",status="429"}[1m]) > 50
  for: 1m
  severity: warning
```

### 9.3 Distributed Tracing (W3C Trace Context)

Every new service **MUST** propagate `traceparent` and `tracestate` headers:
- Incoming: extract from request headers.
- Outgoing Kafka messages: add to message headers.
- Outgoing HTTP calls: set on request headers.
- All logs: include `traceId` and `spanId` as structured fields.

---

## 10. Compliance Controls

### 10.1 GDPR

- Never store personal data (name, email, phone, address) in logs.
- PII fields in databases must be in encrypted columns or separate tables.
- Implement right-to-erasure endpoints for user data.
- Document all PII data flows in `docs/DATA-PRIVACY.md`.

### 10.2 SOC 2 (Type II)

- All admin actions must be auditable (timestamped, actor-identified log entries).
- Change management: all infra changes via IaC in git — no manual console edits in prod.
- Access reviews: document and review all production access quarterly.

### 10.3 CIS Kubernetes Benchmark

- Apply CIS K8s Benchmark Level 1 to all cluster configurations.
- Validate with `kube-bench` on every cluster upgrade.
- Findings tracked and remediated within 30 days (Critical: 7 days).

---

## 11. DevSecOps Definition of Done (DoD) Checklist

Before any feature, service, or infra change is considered complete:

**Container & Build:**
- [ ] Multi-stage Dockerfile with non-root user and `HEALTHCHECK`.
- [ ] `.dockerignore` excludes secrets, tests, `.env*`.
- [ ] `trivy image --exit-code 1 --severity CRITICAL` passes.
- [ ] No `:latest` tags in K8s manifests.

**Kubernetes:**
- [ ] `securityContext` with `runAsNonRoot`, `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`.
- [ ] `NetworkPolicy` restricting ingress/egress to minimum required.
- [ ] `ServiceAccount` with `automountServiceAccountToken: false`.
- [ ] `resources.requests` and `resources.limits` on every container.
- [ ] `livenessProbe`, `readinessProbe`, `startupProbe` configured.
- [ ] `PodDisruptionBudget` for multi-replica deployments.
- [ ] `trivy config --exit-code 1 infrastructure/kubernetes/` passes.

**API & Application:**
- [ ] All new routes registered in correct route file (public/authenticated/admin).
- [ ] Rate limiting configured for all new routes.
- [ ] Input validation via Zod/Pydantic (strict mode, max body size).
- [ ] No raw SQL string interpolation.
- [ ] No secrets, tokens, or PII in logs.
- [ ] Error responses sanitized (no stack traces, file paths, internal identifiers).
- [ ] `x-request-id` correlation ID propagated.

**CI/CD & Secrets:**
- [ ] All GitHub Actions pinned to full SHA.
- [ ] `permissions:` block with minimal grants.
- [ ] Secret scanning step in workflow.
- [ ] New secrets added to `.env.example` as placeholders only.
- [ ] No actual secret values in any committed file.

**Security Testing:**
- [ ] `pnpm test:dast` passes all 8 OWASP phases.
- [ ] DAST test cases added for new routes/features.
- [ ] `pnpm audit --audit-level=high` passes (0 high/critical npm vulnerabilities).

**Documentation:**
- [ ] `docs/MLOPS-ARCHITECTURE-AND-RUNBOOKS.md` updated if ML changes.
- [ ] `docs/ARCHITECTURE.md` updated if topology changes.
- [ ] Security findings documented and remediated.
- [ ] `pnpm skills:sync` run to propagate skill changes to all mirrors.

---

## 12. Security Incident Response Quick Reference

```
1. DETECT:   Alert fires in Grafana / Prometheus / Falco
2. TRIAGE:   Review logs at grafana:3000, prometheus:9090
3. CONTAIN:  kubectl scale deploy/<service> --replicas=0 (if actively exploited)
4. ANALYSE:  Review audit logs, trace IDs, auth failures
5. ERADICATE: Deploy fix via CI pipeline with all gates passing
6. RECOVER:  Gradual rollout (canary → 10% → 100%)
7. REVIEW:   Post-mortem within 48h, update runbooks
```

Full runbooks: `docs/DEVSECOPS-RUNBOOKS.md` (create this file when adding a new service).

---

## 13. Tooling Reference

| Tool | Purpose | Config location |
|---|---|---|
| Trivy | Container + IaC vulnerability scanning | `trivy.yaml` |
| CodeQL | SAST — static code analysis | `.github/workflows/sast.yml` |
| TruffleHog | Secret scanning in git history | CI step |
| Falco | Runtime threat detection (K8s) | `infrastructure/security/falco/` |
| Vault | Secrets management | `infrastructure/security/vault/` |
| kube-bench | CIS K8s benchmark validation | `scripts/kube-bench.sh` |
| cosign | Image signing (Sigstore) | CI step |
| OWASP ZAP | External DAST scanning | `scripts/zap-scan.sh` |
| Prometheus | Metrics + security alerting | `infrastructure/observability/prometheus/` |
| Grafana | Dashboards + alerting UI | `infrastructure/observability/grafana/` |
| Loki | Centralized log aggregation | `infrastructure/observability/loki/` |
| OpenTelemetry | Distributed tracing | `@repo/monitoring` |
