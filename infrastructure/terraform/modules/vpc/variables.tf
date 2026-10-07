variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
}

variable "cluster_name" {
  description = "EKS Cluster Name for subnet tagging"
  type        = string
}

variable "enable_single_nat_gateway" {
  description = "Whether to deploy a single NAT Gateway (for dev/staging)"
  type        = bool
  default     = false
}
