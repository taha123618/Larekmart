# =============================================================================
# Larekmart Production-Grade Infrastructure Root Module
# =============================================================================

module "vpc" {
  source = "./modules/vpc"

  vpc_cidr                  = var.vpc_cidr
  environment               = var.environment
  availability_zones        = var.availability_zones
  cluster_name              = var.cluster_name
  enable_single_nat_gateway = var.enable_single_nat_gateway
}

module "eks" {
  source = "./modules/eks"

  cluster_name            = var.cluster_name
  cluster_version         = var.cluster_version
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  subnet_ids              = module.vpc.private_subnet_ids
  node_group_desired_size = var.node_group_desired_size
  node_group_min_size     = var.node_group_min_size
  node_group_max_size     = var.node_group_max_size
  node_instance_types     = var.node_instance_types
}

module "database" {
  source = "./modules/database"

  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  database_subnet_ids   = module.vpc.database_subnet_ids
  eks_worker_subnet_ids = module.vpc.private_subnet_ids
  db_instance_class     = var.db_instance_class
  db_allocated_storage  = var.db_allocated_storage
  redis_node_type       = var.redis_node_type
}

module "argocd" {
  source = "./modules/argocd"

  environment         = var.environment
  helm_chart_version  = var.argocd_helm_version
  git_repo_url        = "https://github.com/taha123618/Larekmart.git"

  depends_on = [module.eks]
}
