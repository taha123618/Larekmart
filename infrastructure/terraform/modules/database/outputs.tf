output "postgres_endpoint" {
  description = "Connection endpoint for PostgreSQL RDS"
  value       = aws_db_instance.postgres.endpoint
}

output "postgres_address" {
  description = "Hostname for PostgreSQL RDS"
  value       = aws_db_instance.postgres.address
}

output "postgres_port" {
  description = "Port for PostgreSQL RDS"
  value       = aws_db_instance.postgres.port
}

output "postgres_db_name" {
  description = "Initial database name"
  value       = aws_db_instance.postgres.db_name
}

output "postgres_admin_username" {
  description = "Admin username for PostgreSQL"
  value       = aws_db_instance.postgres.username
}

output "postgres_admin_password" {
  description = "Generated master password for PostgreSQL"
  value       = random_password.postgres_master.result
  sensitive   = true
}

output "redis_primary_endpoint" {
  description = "Primary endpoint address for Redis"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}
