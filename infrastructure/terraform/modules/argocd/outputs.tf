output "argocd_namespace" {
  description = "The namespace where Argo CD is installed"
  value       = kubernetes_namespace.argocd.metadata[0].name
}

output "argocd_release_name" {
  description = "Helm release name for Argo CD"
  value       = helm_release.argocd.name
}

output "argocd_helm_status" {
  description = "Status of the Argo CD Helm deployment"
  value       = helm_release.argocd.status
}
