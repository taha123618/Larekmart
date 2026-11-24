variable "environment" {
  description = "Target deployment environment (development, staging, production)"
  type        = string
}

variable "rate_limit_requests" {
  description = "Maximum requests allowed from a single IP address per 5-minute evaluation window"
  type        = number
  default     = 2000
}
