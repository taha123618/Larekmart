output "waf_acl_arn" {
  description = "ARN of the AWS WAF v2 Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}

output "waf_acl_id" {
  description = "ID of the AWS WAF v2 Web ACL"
  value       = aws_wafv2_web_acl.main.id
}
