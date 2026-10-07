variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "database_subnet_ids" {
  description = "Subnet IDs for database deployment"
  type        = list(string)
}

variable "eks_worker_subnet_ids" {
  description = "Subnet IDs for EKS worker nodes to allow inbound traffic"
  type        = list(string)
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
}
