resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "larekmart-vpc-${var.environment}"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "larekmart-igw-${var.environment}"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Subnets: Public (Ingress, NATs, Bastion)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name                                           = "larekmart-public-${var.environment}-${var.availability_zones[count.index]}"
    "kubernetes.io/role/elb"                      = "1"
    "kubernetes.io/cluster/${var.cluster_name}"   = "shared"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Subnets: Private App (EKS Worker Nodes, Microservices)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 4)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name                                           = "larekmart-private-${var.environment}-${var.availability_zones[count.index]}"
    "kubernetes.io/role/internal-elb"             = "1"
    "kubernetes.io/cluster/${var.cluster_name}"   = "shared"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Subnets: Database (RDS, ElastiCache)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_subnet" "database" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 8)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "larekmart-db-${var.environment}-${var.availability_zones[count.index]}"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# NAT Gateways & Elastic IPs
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_eip" "nat" {
  count  = var.enable_single_nat_gateway ? 1 : length(var.availability_zones)
  domain = "vpc"

  tags = {
    Name = "larekmart-nat-eip-${var.environment}-${count.index}"
  }
}

resource "aws_nat_gateway" "nat" {
  count         = var.enable_single_nat_gateway ? 1 : length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "larekmart-nat-${var.environment}-${count.index}"
  }

  depends_on = [aws_internet_gateway.igw]
}

# ─────────────────────────────────────────────────────────────────────────────
# Route Tables
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "larekmart-public-rt-${var.environment}"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.enable_single_nat_gateway ? aws_nat_gateway.nat[0].id : aws_nat_gateway.nat[count.index].id
  }

  tags = {
    Name = "larekmart-private-rt-${var.environment}-${var.availability_zones[count.index]}"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "larekmart-db-rt-${var.environment}"
  }
}

resource "aws_route_table_association" "database" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# ─────────────────────────────────────────────────────────────────────────────
# S3 Gateway Endpoint (Free & High-Throughput for ECR / Backups)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${data.aws_region.current.name}.s3"

  route_table_ids = concat(
    [aws_route_table.public.id],
    aws_route_table.private[*].id
  )

  tags = {
    Name = "larekmart-s3-endpoint-${var.environment}"
  }
}

data "aws_region" "current" {}
