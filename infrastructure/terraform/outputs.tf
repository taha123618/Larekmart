output "vpc_id" {
  description = "The ID of the provisioned VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_name" {
  description = "The EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Endpoint URL for Kubernetes API server"
  value       = module.eks.cluster_endpoint
}

output "eks_kubeconfig_command" {
  description = "Run this command to configure local kubectl to connect to the cluster"
  value       = "aws eks --region ${var.aws_region} update-kubeconfig --name ${module.eks.cluster_name}"
}

output "postgres_endpoint" {
  description = "PostgreSQL database connection endpoint"
  value       = module.database.postgres_endpoint
}

output "postgres_db_name" {
  description = "Initial PostgreSQL database name"
  value       = module.database.postgres_db_name
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis primary endpoint address"
  value       = module.database.redis_primary_endpoint
}

output "argocd_helm_status" {
  description = "Status of Argo CD deployment"
  value       = module.argocd.argocd_helm_status
}
