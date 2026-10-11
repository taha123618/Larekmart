aws_region                = "us-east-1"
environment               = "dev"
vpc_cidr                  = "10.10.0.0/16"
availability_zones        = ["us-east-1a", "us-east-1b", "us-east-1c"]
cluster_name              = "larekmart-eks-dev"
cluster_version           = "1.30"
enable_single_nat_gateway = true

node_group_desired_size   = 2
node_group_min_size       = 1
node_group_max_size       = 4
node_instance_types       = ["t3.large"]

db_instance_class         = "db.t4g.small"
db_allocated_storage      = 20
redis_node_type           = "cache.t4g.micro"
