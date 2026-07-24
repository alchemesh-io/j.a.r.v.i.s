## MODIFIED Requirements

### Requirement: ArgoCD Application CR deploys the full J.A.R.V.I.S stack
The system SHALL provide ArgoCD `Application` manifests: `argocd/jarvis-app.yaml` (GHCR images) and `argocd/jarvis-app-local.yaml` (local images with overrides) for the JARVIS stack. All Application CRs SHALL target their respective Helm charts with `targetRevision: HEAD` and automated sync policy. There is no JAAR Application CR — JAAR has been decommissioned.

#### Scenario: Application syncs successfully on Minikube
- **WHEN** ArgoCD syncs the JARVIS Application CR against a running Minikube cluster
- **THEN** the release is created, all pods reach `Running` state, and services are accessible via the Istio ingress gateway

#### Scenario: Local deployment uses image overrides
- **WHEN** `make deploy-local` applies the local Application CR
- **THEN** image repositories are overridden to `jarvis-*` with git-SHA tags and `pullPolicy: Never`

#### Scenario: Application uninstalled via CR deletion
- **WHEN** the ArgoCD Application CR is deleted (e.g., via `make undeploy`)
- **THEN** all Kubernetes resources created by the chart are removed via cascade finalizer

### Requirement: Minikube memory recommendation
The Makefile or its documentation SHALL recommend a `MINIKUBE_MEMORY` value sized for the JARVIS stack (backend, frontend, MCP server, Istio, ArgoCD) without JAAR's PostgreSQL + AgentRegistry overhead.

#### Scenario: Default memory sufficient for full stack
- **WHEN** `make cluster-up` is run with the documented default `MINIKUBE_MEMORY`
- **THEN** the cluster has enough memory to run the JARVIS stack, or documentation recommends a higher value

## REMOVED Requirements

### Requirement: Makefile targets for JAAR deployment
**Reason**: JAAR has been decommissioned in favor of GCS-hosted skills and Gemini Enterprise Agent Registry; see `skill-gcs-hosting` and `agent-platform-registration`.
**Migration**: No replacement Makefile target is needed — `deploy-local` no longer builds, loads, or applies any JAAR-related resources.
