resource "kubernetes_namespace" "argocd" {
  metadata {
    name = "argocd"
    labels = {
      "app.kubernetes.io/part-of" = "argocd"
    }
  }
}

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = var.helm_chart_version
  namespace  = kubernetes_namespace.argocd.metadata[0].name

  values = [
    file("${path.module}/../../argocd/values.yaml")
  ]

  set {
    name  = "configs.params.server\\.insecure"
    value = "true"
  }

  depends_on = [kubernetes_namespace.argocd]
}

# ─────────────────────────────────────────────────────────────────────────────
# Apply Initial AppProject & Root Application via kubectl manifest
# ─────────────────────────────────────────────────────────────────────────────
resource "kubernetes_manifest" "argocd_project" {
  manifest = yamldecode(file("${path.module}/../../argocd/project.yaml"))

  depends_on = [helm_release.argocd]
}

resource "kubernetes_manifest" "argocd_root_app" {
  manifest = yamldecode(file("${path.module}/../../argocd/root-app.yaml"))

  depends_on = [kubernetes_manifest.argocd_project]
}
