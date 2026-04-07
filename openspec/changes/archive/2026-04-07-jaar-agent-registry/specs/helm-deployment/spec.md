## MODIFIED Requirements

### Requirement: ArgoCD Application CR deploys the full J.A.R.V.I.S stack
The system SHALL provide ArgoCD `Application` manifests: `argocd/jarvis-app.yaml` (GHCR images) and `argocd/jarvis-app-local.yaml` (local images with overrides) for the JARVIS stack. Additionally, the system SHALL provide `argocd/jaar-app.yaml` and `argocd/jaar-app-local.yaml` for the JAAR (AgentRegistry) stack. All Application CRs SHALL target their respective Helm charts with `targetRevision: HEAD` and automated sync policy.

#### Scenario: Application syncs successfully on Minikube
- **WHEN** ArgoCD syncs the JARVIS and JAAR Application CRs against a running Minikube cluster
- **THEN** both releases are created, all pods reach `Running` state, and services are accessible via the Istio ingress gateway

#### Scenario: Local deployment uses image overrides
- **WHEN** `make deploy-local` applies the local Application CRs
- **THEN** image repositories are overridden to `jarvis-*` and `jaar-*` with git-SHA tags and `pullPolicy: Never`

#### Scenario: Application uninstalled via CR deletion
- **WHEN** the ArgoCD Application CRs are deleted (e.g., via `make undeploy`)
- **THEN** all Kubernetes resources created by both charts are removed via cascade finalizer

## ADDED Requirements

### Requirement: Makefile targets for JAAR deployment
The Makefile SHALL include targets for building and loading JAAR-related images into Minikube for local deployment. The `deploy-local` target SHALL apply both JARVIS and JAAR local Application CRs.

#### Scenario: JAAR images built and loaded for local deploy
- **WHEN** `make deploy-local` is executed
- **THEN** JAAR-related images are built, loaded into Minikube, and the JAAR local Application CR is applied

### Requirement: Minikube memory recommendation
The Makefile or its documentation SHALL note that PostgreSQL + AgentRegistry adds overhead and recommend increasing `MINIKUBE_MEMORY` when running the full stack (JARVIS + JAAR + Istio + ArgoCD).

#### Scenario: Default memory sufficient for full stack
- **WHEN** `make cluster-up` is run with default `MINIKUBE_MEMORY=8192`
- **THEN** the cluster has enough memory to run all services, or documentation recommends a higher value
