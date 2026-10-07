variable "environment" {
  description = "Environment name"
  type        = string
}

variable "helm_chart_version" {
  description = "Argo CD Helm chart version"
  type        = string
  default     = "7.3.11"
}

variable "git_repo_url" {
  description = "Larekmart Git repository URL for bootstrapping"
  type        = string
  default     = "https://github.com/taha123618/Larekmart.git"
}
