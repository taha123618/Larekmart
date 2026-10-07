# ─────────────────────────────────────────────────────────────────────────────
# Random Passwords & KMS Encryption
# ─────────────────────────────────────────────────────────────────────────────
resource "random_password" "postgres_master" {
  length  = 24
  special = false
}

resource "aws_kms_key" "db" {
  description             = "KMS Key for Larekmart DB storage encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "larekmart-db-kms-${var.environment}"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# DB Subnet Groups
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "rds" {
  name       = "larekmart-rds-subnet-group-${var.environment}"
  subnet_ids = var.database_subnet_ids

  tags = {
    Name = "larekmart-rds-subnet-group-${var.environment}"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "larekmart-redis-subnet-group-${var.environment}"
  subnet_ids = var.database_subnet_ids

  tags = {
    Name = "larekmart-redis-subnet-group-${var.environment}"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Security Groups
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "larekmart-rds-sg-${var.environment}"
  description = "Access to RDS PostgreSQL from VPC"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "larekmart-rds-sg-${var.environment}"
  }
}

resource "aws_security_group" "redis" {
  name        = "larekmart-redis-sg-${var.environment}"
  description = "Access to Redis from VPC"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "larekmart-redis-sg-${var.environment}"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# RDS PostgreSQL Instance
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_db_instance" "postgres" {
  identifier                  = "larekmart-postgres-${var.environment}"
  engine                      = "postgres"
  engine_version              = "16.3"
  instance_class              = var.db_instance_class
  allocated_storage           = var.db_allocated_storage
  max_allocated_storage       = var.db_allocated_storage * 3
  storage_type                = "gp3"
  storage_encrypted           = true
  kms_key_id                  = aws_kms_key.db.arn

  db_name                     = "larekmart_main"
  username                    = "larekmart_admin"
  password                    = random_password.postgres_master.result

  db_subnet_group_name        = aws_db_subnet_group.rds.name
  vpc_security_group_ids      = [aws_security_group.rds.id]
  publicly_accessible         = false

  multi_az                    = var.environment == "prod" ? true : false
  backup_retention_period     = var.environment == "prod" ? 30 : 7
  backup_window               = "03:00-04:00"
  maintenance_window          = "Sun:04:30-Sun:05:30"
  auto_minor_version_upgrade  = true
  deletion_protection         = var.environment == "prod" ? true : false
  skip_final_snapshot         = var.environment == "prod" ? false : true
  final_snapshot_identifier   = "larekmart-postgres-${var.environment}-final-snap"

  tags = {
    Name = "larekmart-postgres-${var.environment}"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache Redis Cluster
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "larekmart-redis-${var.environment}"
  description                = "Redis cluster for Larekmart caching and session storage"
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.environment == "prod" ? 2 : 1
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]

  automatic_failover_enabled = var.environment == "prod" ? true : false
  multi_az_enabled           = var.environment == "prod" ? true : false
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false

  tags = {
    Name = "larekmart-redis-${var.environment}"
  }
}
