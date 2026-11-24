# Larekmart Service Enterprise Helm Chart

Enterprise-grade, cloud-native Helm chart for deploying microservices and frontends within the Larekmart e-commerce platform.

## Security & Compliance Defaults

- **Pod Security Standards**: Pre-configured for Kubernetes `restricted` PSS profile.
- **Non-Root Execution**: Runs strictly as UID 1000 (`runAsNonRoot: true`).
- **Read-Only Root Filesystem**: `readOnlyRootFilesystem: true` with ephemeral `/tmp` emptyDir.
- **Capabilities**: All Linux capabilities dropped (`capabilities.drop: ["ALL"]`).
- **Zero-Trust Network Policies**: Ingress permitted solely from API Gateway; egress restricted with cloud metadata IP (`169.254.169.254`) blocked.
- **Workload Identity**: ServiceAccount configured with `automountServiceAccountToken: false` and IRSA support.

## Usage

### 1. Lint and Test

```bash
helm lint infrastructure/helm/larekmart
helm template my-release infrastructure/helm/larekmart
```

### 2. Deploying a Microservice (e.g. `order-service`)

```bash
helm upgrade --install order-service infrastructure/helm/larekmart \
  --namespace larekmart \
  --set image.repository="larekmart/order-service" \
  --set image.tag="sha-e1cdfe4" \
  --set service.port=8001
```

## Configuration Reference

| Parameter                                     | Description                       | Default   |
| :-------------------------------------------- | :-------------------------------- | :-------- |
| `replicaCount`                                | Number of pods                    | `2`       |
| `podSecurityContext.runAsNonRoot`             | Enforce non-root                  | `true`    |
| `securityContext.readOnlyRootFilesystem`      | Read-only filesystem              | `true`    |
| `securityContext.capabilities.drop`           | Dropped capabilities              | `["ALL"]` |
| `serviceAccount.automountServiceAccountToken` | Token exfiltration defense        | `false`   |
| `autoscaling.enabled`                         | Enable Horizontal Pod Autoscaling | `true`    |
| `networkPolicy.enabled`                       | Deploy Zero-Trust Network Policy  | `true`    |
