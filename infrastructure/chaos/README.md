# Chaos Engineering & Resilience Guardrails

This directory contains declarative **Chaos Mesh** custom resource definitions (CRDs) designed to validate the multi-database checkout Saga, Kafka transactional outbox resilience, and API Gateway adaptive rate-limiting guardrails across Larekmart's Kubernetes infrastructure.

---

## Architecture & Failure Injection Matrix

Larekmart coordinates consistency across three distinct database engines (PostgreSQL inventory, MongoDB orders, MySQL tax) and asynchronous Kafka event streams. The chaos experiments below simulate transient network failures, partition drops, and broker crashes to guarantee automated compensations execute without human intervention or data drift.

| Experiment Manifest                                                  | Kind           | Target Service & Layer                  | Chaos Type                                    | Tested System Guarantee                                                                         |
| :------------------------------------------------------------------- | :------------- | :-------------------------------------- | :-------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| [`tax-mysql-latency.yaml`](./tax-mysql-latency.yaml)                 | `NetworkChaos` | `tax-service` → MySQL (3306)            | Injected Latency (`3500ms ± 500ms`)           | Dual-ACK timeout sweeper triggers clean Saga rollback (`payment.refund` + `inventory.release`). |
| [`order-mongo-partition.yaml`](./order-mongo-partition.yaml)         | `NetworkChaos` | `order-service` ↔ MongoDB (27017)      | Network Partition (100% drop)                 | Transactional outbox durable queueing and idempotent retry backoff with zero message loss.      |
| [`kafka-broker-kill.yaml`](./kafka-broker-kill.yaml)                 | `PodChaos`     | `kafka-cluster`                         | Pod Kill (`fixed: 1`)                         | Outbox relay connection retry loop; broker failover recovery without consumer group corruption. |
| [`inventory-pg-loss.yaml`](./inventory-pg-loss.yaml)                 | `NetworkChaos` | `inventory-service` → PostgreSQL (5432) | Corrupted Packets (`30%`) & Latency (`200ms`) | Redis stock gatekeeper fast-fail and edge circuit breaker trip.                                 |
| [`flash-sale-chaos-workflow.yaml`](./flash-sale-chaos-workflow.yaml) | `Workflow`     | Multi-tier orchestration                | Serial Chaos Pipeline                         | Full flash-sale lifecycle validation under cascading failure conditions.                        |

---

## 1. Prerequisites & Installation

Deploy the CNCF **Chaos Mesh** operator into your Kubernetes cluster:

```bash
# Add Chaos Mesh Helm repository
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm repo update

# Install Chaos Mesh into chaos-mesh namespace with container runtime socket
helm install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace=chaos-mesh \
  --create-namespace \
  --set chaosDaemon.runtime=containerd \
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \
  --version 2.6.2
```

Verify that Chaos Mesh pods are running:

```bash
kubectl get pods -n chaos-mesh -l app.kubernetes.io/instance=chaos-mesh
```

---

## 2. Executing Chaos Experiments

Apply all experiments using Kustomize:

```bash
# Validate manifests without applying
kubectl kustomize infrastructure/chaos/

# Apply targeted tax-service latency experiment
kubectl apply -f infrastructure/chaos/tax-mysql-latency.yaml

# Monitor active experiment execution
kubectl get networkchaos -n larekmart
kubectl describe networkchaos tax-mysql-latency -n larekmart

# Terminate / Clean up experiment
kubectl delete -f infrastructure/chaos/tax-mysql-latency.yaml
```

To run the automated serial flash-sale workflow:

```bash
kubectl apply -f infrastructure/chaos/flash-sale-chaos-workflow.yaml
kubectl get workflows.chaos-mesh.org -n larekmart -w
```

---

## 3. Observability & Verification Checklist

While experiments are executing under active load (e.g., via k6 or synthetic checkout scripts):

1. **API Gateway Adaptive Rate Limiting**:
   - Check `gateway_circuit_breaker_state` metric. When `tax-service` or `order-service` trips, circuit breaker enters `OPEN` (state = 2).
   - Gateway dynamically clamps `/checkout` and `/payments` rate limits and sheds excess requests with `429 Too Many Requests` or `503 Service Unavailable` with `Retry-After: 30`.
   - Verify `gateway_rate_limit_hits_total{route="/checkout"}` increments.

2. **Order Saga Automated Compensation**:
   - Inspect `order-service` logs for timeout sweeper execution:
     ```
     [order-service:saga-orchestrator] Dual-ACK confirmation timed out after 60s
     [order-service:outbox-relay] Outbox event created for topic: inventory.release
     [order-service:outbox-relay] Outbox event created for topic: payment.refund
     ```
   - Verify that 100% of orders trapped in `pending_confirmation` past the 60s timeout window transition to `cancelled` or `failed_tax_calculation`.

3. **Inventory Zero-Leakage Invariant**:
   - Confirm that reserved inventory units are returned to available stock via `inventory.release` consumer.
   - Verify zero stock drift between Redis gatekeeper counters and PostgreSQL ledger.
