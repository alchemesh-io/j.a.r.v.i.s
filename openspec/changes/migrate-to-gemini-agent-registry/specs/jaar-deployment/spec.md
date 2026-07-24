## REMOVED Requirements

### Requirement: ArgoCD Application CRs for JAAR
**Reason**: JAAR has been decommissioned — skills move to a GCS bucket (`skill-gcs-hosting`) and agent/MCP-server registration moves to Gemini Enterprise Agent Registry via GKE auto-discovery (`agent-platform-registration`); a self-hosted AgentRegistry deployment is no longer needed.
**Migration**: Delete `argocd/jaar-app.yaml` and `argocd/jaar-app-local.yaml`. No replacement Application CR is created.

### Requirement: Dedicated jaar namespace with Istio sidecar injection
**Reason**: The `jaar` namespace and everything in it is removed along with JAAR.
**Migration**: Delete the namespace and its resources; no replacement namespace is created.

### Requirement: AgentRegistry via upstream Helm subchart
**Reason**: The upstream `agentregistry-dev/agentregistry` chart dependency is no longer used.
**Migration**: Remove `helm/jaar/` entirely.

### Requirement: ClusterIP Service for AgentRegistry
**Reason**: No AgentRegistry deployment remains to back a Service.
**Migration**: No replacement Service is created.

### Requirement: Bundled PostgreSQL
**Reason**: The bundled PostgreSQL existed solely to back AgentRegistry's own data store; with JAAR gone, it is no longer needed.
**Migration**: No replacement database is provisioned by this repository.

### Requirement: JAAR secrets management
**Reason**: JAAR's JWT signing key and database credentials are no longer needed.
**Migration**: Delete `secrets/jaar-secret.yaml` and `secrets/jaar-secret.example.yaml`; remove the Makefile's `_deploy-jaar-secrets` target.

### Requirement: Helm chart structure
**Reason**: The `helm/jaar/` chart is deleted in its entirety.
**Migration**: None — no successor chart exists for this capability.
