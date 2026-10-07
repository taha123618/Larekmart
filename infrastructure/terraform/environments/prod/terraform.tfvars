aws_region                = "us-east-1"
environment               = "prod"
vpc_cidr                  = "10.20.0.0/16"
availability_zones        = ["us-east-1a", "us-east-1b", "us-east-1c"]
cluster_name              = "larekmart-eks-prod"
cluster_version           = "1.30"
enable_single_nat_gateway = false  # Multi-AZ HA NAT Gateways for production

node_group_desired_size   = 5
node_group_min_size       = 3
node_group_max_size       = 15
node_instance_types       = ["m6i.xlarge", "m5.xlarge"]

db_instance_class         = "db.r6g.xlarge"
db_allocated_storage      = 200
redis_node_type           = "cache.r6g.large"
