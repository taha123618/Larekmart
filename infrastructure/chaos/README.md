# Chaos Engineering & Resilience Guardrails

This directory contains declarative **Chaos Mesh** custom resource definitions (CRDs) designed to validate the multi-database checkout Saga, Kafka transactional outbox resilience, and API Gateway adaptive rate-limiting guardrails across Larekmart's Kubernetes infrastructure.

---

## Architecture & Failure Injection Matrix

Larekmart coordinates consistency across three distinct database engines (PostgreSQL inventory, MongoDB orders, MySQL tax) and asynchronous Kafka event streams. The chaos experiments below simulate transient network failures, partition drops, and broker crashes to guarantee automated compensations execute without human intervention or data drift.

| Experiment Manifest                                                              | Kind           | Target Service & Layer                                       | Chaos Type                                    | Tested System Guarantee                                                                                                                                                                                  |
| :------------------------------------------------------------------------------- | :------------- | :----------------------------------------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`tax-mysql-latency.yaml`](./tax-mysql-latency.yaml)                             | `NetworkChaos` | `tax-service` → MySQL (3306)                                 | Injected Latency (`3500ms ± 500ms`)           | Dual-ACK timeout sweeper triggers clean Saga rollback (`payment.refund` + `inventory.release`).                                                                                                          |
| [`order-mongo-partition.yaml`](./order-mongo-partition.yaml)                     | `NetworkChaos` | `order-service` ↔ MongoDB (27017)                           | Network Partition (100% drop)                 | Transactional outbox durable queueing and idempotent retry backoff with zero message loss.                                                                                                               |
| [`kafka-broker-kill.yaml`](./kafka-broker-kill.yaml)                             | `PodChaos`     | `kafka-cluster`                                              | Pod Kill (`fixed: 1`)                         | Outbox relay connection retry loop; broker failover recovery without consumer group corruption.                                                                                                          |
| [`inventory-pg-loss.yaml`](./inventory-pg-loss.yaml)                             | `NetworkChaos` | `inventory-service` → PostgreSQL (5432)                      | Corrupted Packets (`30%`) & Latency (`200ms`) | Redis stock gatekeeper fast-fail and edge circuit breaker trip.                                                                                                                                          |
| [`catalog-replica-replication-lag.yaml`](./catalog-replica-replication-lag.yaml) | `NetworkChaos` | `catalog-service` → PostgreSQL replica (6432)                | Injected Latency (`1500ms ± 600ms`)           | LSN-aware Read-Your-Writes lease fails over storefront reads to primary while the standby replay position exceeds the session high-water mark, then returns to the replica plane once replay catches up. |
| [`flash-sale-chaos-workflow.yaml`](./flash-sale-chaos-workflow.yaml)             | `Workflow`     | Multi-tier orchestration                                     | Serial Chaos Pipeline                         | Full flash-sale lifecycle validation under cascading failure conditions.                                                                                                                                 |
| [`flash-sale-mixed-traffic.yaml`](./flash-sale-mixed-traffic.yaml)               | `Workflow`     | `order-service` ↔ Mongo **and** `catalog-service` → replica | Parallel order + read plane degradation       | Flash-sale checkout storm keeps order writes durable on the sharded Mongo plane while per-session catalog reads fail over to the primary plane and bystanders stay on the replica.                       |

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

## 2.1 Local e2e companion (no k8s required)

Two catalog-service test suites exercise the replication-lag failover live on the local
development stack (real HTTP server, real Redis, real PostgreSQL), so the routing behavior
can be verified without a cluster:

```bash
# LSN-aware routing decision matrix + failover plugin seed
pnpm --filter catalog-service test

# Standalone chaos drill: fail-safe, injected lag, recovery + mixed-traffic flash-sale checkout storm
cd apps/catalog-service && npx tsx tests/catalog-lag-chaos-e2e.test.ts
```

The mixed-traffic scenario drives concurrent checkout writes (real WAL mutations emitting the
session LSN high-water marks), buyer reads failing over to primary, and bystander browsing
staying on the replica while the standby lags. Drill findings are recorded in
[`findings/catalog-replica-lag-drill-2026-11-03.md`](./findings/catalog-replica-lag-drill-2026-11-03.md).

---

## 2.2 Mixed-traffic flash-sale routing drill

[`flash-sale-mixed-traffic.yaml`](./flash-sale-mixed-traffic.yaml) is the **parallel**
companion to the serial flash-sale workflow. Instead of failing one tier at a time, it
degrades the two routing planes that every checkout straddles at the same instant:

| Plane     | Injected fault                                                   | Routing decision under test                                                                                                                                                                      |
| :-------- | :--------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Order** | `900ms ± 250ms` delay, `order-service` ↔ `mongo`, bidirectional | Checkout commits and order-history reads keep targeting the `{ userId: "hashed" }` shards; writes stay durable, retries stay idempotent, and the outbox relay drains after recovery.             |
| **Read**  | `1500ms ± 600ms` delay, `catalog-service` → `postgres-replica`   | Mutating sessions (checkout LSN ahead of replay) fail over to `primary-master`; sessions with no checkout history stay on the replica; everything returns to the replica once replay catches up. |

The two `NetworkChaos` templates run under a `Parallel` branch for four minutes, followed by
a one-minute `Suspend` recovery window. Run the checkout storm from a synthetic driver (k6,
the staging traffic verifier, or a client script) with this traffic profile:

1. **Checkout writes** — concurrent `POST /api/v1/orders/cod` (or Stripe checkout) for
   distinct buyers, each with an `Idempotency-Key`, so writes scatter across hashed order
   shards.
2. **Post-checkout reads** — each buyer immediately calls `GET /api/v1/catalog/products`
   with its `x-session-id`; the gateway has already checkpointed the mutation's `x-db-lsn`
   into the RYW lease.
3. **Bystander reads** — anonymous storefront traffic with no `x-session-id` hitting the
   same catalog endpoints throughout the window.

Apply and observe the scenario:

```bash
kubectl apply -f infrastructure/chaos/flash-sale-mixed-traffic.yaml
kubectl get workflows.chaos-mesh.org -n larekmart flash-sale-mixed-traffic -w
kubectl get networkchaos -n larekmart -l larekmart.io/traffic-profile=flash-sale-mixed

# Teardown
kubectl delete -f infrastructure/chaos/flash-sale-mixed-traffic.yaml
```

Expected invariants during the storm:

- **Order plane:** every acknowledged checkout is readable afterwards (no lost writes while
  Mongo latency is injected), idempotent retries replay instead of duplicating, and
  `order-service` outbox depth returns to zero during the recovery window.
- **Read plane:** buyer reads carry `x-consistency-plane: primary-master` while the replica
  lags; bystander reads carry no consistency header; after the recovery window every buyer
  read drops back to the replica plane.
- **Gateway:** `/checkout` circuit breakers may flap, but `/catalog` and `/search` remain
  unthrottled so the flash-sale spike cannot drag read traffic into the degraded order plane.

Offline companions: `pnpm --filter order-service test` exercises order-plane durability and
saga compensation, while the catalog e2e above exercises the read-routing matrix.

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
