## REMOVED Requirements

### Requirement: ArgoCD Application CRs for JAAR
**Reason**: JAAR is decommissioned entirely — skills are hosted by the GCP Agent Registry Skills API and JAAR was never actually deployed on the target sandbox cluster (no live namespace or ArgoCD Application existed there). This was local-dev-only tooling.
**Migration**: Delete `argocd/jaar-app.yaml` and `argocd/jaar-app-local.yaml`. No live ArgoCD Application to deregister on the target cluster.

### Requirement: Dedicated jaar namespace with Istio sidecar injection
**Reason**: No JAAR chart is deployed anywhere anymore; the namespace this requirement describes was local-dev-only and never existed on the target cluster.
**Migration**: No action needed on the target cluster. `helm/jaar/templates/namespace.yaml` is deleted along with the rest of the chart.

### Requirement: AgentRegistry via upstream Helm subchart
**Reason**: Replaced by the GCP-managed Agent Registry API — no self-hosted AgentRegistry deployment is needed.
**Migration**: Delete `helm/jaar/` entirely, including the `Chart.yaml` dependency on the upstream `agentregistry` chart.

### Requirement: ClusterIP Service for AgentRegistry
**Reason**: No self-hosted AgentRegistry service exists anymore.
**Migration**: No action needed; removed along with the chart.

### Requirement: Bundled PostgreSQL
**Reason**: The GCP Agent Registry API manages its own storage; JARVIS no longer owns a Postgres instance for this purpose.
**Migration**: No action needed; removed along with the chart. No data migration — the bundled Postgres was local-dev-only.

### Requirement: JAAR secrets management
**Reason**: No JAAR credentials are needed once the chart is removed.
**Migration**: Delete `secrets/jaar-secret.yaml` (if present locally) and `secrets/jaar-secret.example.yaml`. Remove the Makefile `_deploy-jaar-secrets` target.

### Requirement: Helm chart structure
**Reason**: The chart is deleted in its entirety as part of this change.
**Migration**: Delete `helm/jaar/` (Chart.yaml, values.yaml, templates/, Chart.lock).
