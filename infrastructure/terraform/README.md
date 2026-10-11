# Terraform Infrastructure as Code for Larekmart

This directory contains the production-grade Infrastructure as Code (IaC) configuration for provisioning Larekmart's AWS cloud infrastructure, EKS cluster, managed data layers, and GitOps control plane.

## Architecture Overview

```
                      AWS VPC (Multi-AZ)
 ┌────────────────────────────────────────────────────────────┐
 │  Public Subnets (NAT Gateways, ALBs, Internet Gateways)    │
 ├────────────────────────────────────────────────────────────┤
 │  Private App Subnets (EKS Managed Node Groups)             │
 │    ├─ Microservices Pods                                   │
 │    ├─ Argo CD GitOps Engine                                │
 │    └─ Kube-Prometheus / Observability                     │
 ├────────────────────────────────────────────────────────────┤
 │  Database Subnets (Isolated, No Direct Egress)             │
 │    ├─ Multi-AZ Amazon RDS PostgreSQL 16                    │
 │    └─ Amazon ElastiCache Redis 7                           │
 └────────────────────────────────────────────────────────────┘
```

## Directory Structure

| Path                 | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `versions.tf`        | Required Terraform CLI and provider versions (AWS, K8s, Helm)      |
| `main.tf`            | Root module connecting VPC, EKS, Database, and Argo CD modules     |
| `variables.tf`       | Global configurable variables with production defaults             |
| `outputs.tf`         | Exported endpoints, cluster IDs, and kubeconfig connection strings |
| `modules/vpc`        | Multi-AZ VPC with public, private, and isolated database subnets   |
| `modules/eks`        | Managed EKS cluster with KMS secret encryption, IRSA, and addons   |
| `modules/database`   | RDS PostgreSQL and ElastiCache Redis replication groups            |
| `modules/argocd`     | Helm-driven Argo CD bootstrap module with root GitOps app          |
| `environments/dev/`  | Development environment `.tfvars` and S3 backend configuration     |
| `environments/prod/` | Production environment `.tfvars` with HA sizing and Multi-AZ       |

---

## Deployment Instructions

### 1. Prerequisites

- [Terraform CLI](https://developer.hashicorp.com/terraform/downloads) `>= 1.7.0`
- [AWS CLI](https://aws.amazon.com/cli/) `>= 2.15.0` configured with administrative permissions
- Target S3 Bucket and DynamoDB table for state storage and locking:

  ```bash
  # Create S3 state bucket
  aws s3api create-bucket --bucket larekmart-terraform-state-dev --region us-east-1
  aws s3api put-bucket-versioning --bucket larekmart-terraform-state-dev --versioning-configuration Status=Enabled

  # Create DynamoDB lock table
  aws dynamodb create-table \
    --table-name larekmart-terraform-locks-dev \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1
  ```

### 2. Initialize Backend

```bash
cd infrastructure/terraform

# Initialize for development
terraform init -backend-config=environments/dev/backend.tfvars
```

### 3. Plan Infrastructure

```bash
terraform plan -var-file=environments/dev/terraform.tfvars -out=tfplan-dev
```

### 4. Apply Changes

```bash
terraform apply tfplan-dev
```

### 5. Connect to the EKS Cluster

After apply completes, configure your local `kubectl`:

```bash
$(terraform output -raw eks_kubeconfig_command)
kubectl get nodes
kubectl get pods -n argocd
```

---

## Clean Up / Destroy

```bash
terraform destroy -var-file=environments/dev/terraform.tfvars
```
