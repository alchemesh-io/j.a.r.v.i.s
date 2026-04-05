## ADDED Requirements

### Requirement: ArgoCD Application CRs for JAAR
The system SHALL provide ArgoCD `Application` manifests: `argocd/jaar-app.yaml` (GHCR images) and `argocd/jaar-app-local.yaml` (local images with overrides). Both SHALL target `helm/jaar/` with `targetRevision: HEAD` and automated sync policy.

#### Scenario: JAAR application syncs successfully on Minikube
- **WHEN** ArgoCD syncs the JAAR Application CR against a running Minikube cluster
- **THEN** the release is created, all JAAR pods reach `Running` state, and the AgentRegistry HTTP API is accessible on port 12121

#### Scenario: Local JAAR deployment uses image overrides
- **WHEN** `make deploy-local` applies the local JAAR Application CR
- **THEN** image repositories are overridden with `pullPolicy: Never` and a git-SHA tag

#### Scenario: JAAR application uninstalled via CR deletion
- **WHEN** the JAAR ArgoCD Application CR is deleted
- **THEN** all Kubernetes resources in the `jaar` namespace created by the chart are removed via cascade finalizer

### Requirement: Dedicated jaar namespace with Istio sidecar injection
The Helm chart SHALL create a `jaar` namespace via `templates/namespace.yaml` with the label `istio-injection: enabled`.

#### Scenario: Namespace created on sync
- **WHEN** ArgoCD syncs the JAAR Helm chart
- **THEN** a `jaar` namespace exists with `istio-injection=enabled` label

#### Scenario: JAAR pods receive Istio sidecar
- **WHEN** pods start in the `jaar` namespace
- **THEN** each pod has an `istio-proxy` sidecar container injected automatically

### Requirement: AgentRegistry Deployment
The Helm chart SHALL include a Deployment for AgentRegistry using image `ghcr.io/agentregistry-dev/agentregistry:server` (tag `0.2.1`). The container SHALL expose ports 12121 (HTTP), 21212 (gRPC), and 31313 (MCP). The following environment variables SHALL be configured: `AGENT_REGISTRY_DATABASE_URL` (PostgreSQL connection string), `AGENT_REGISTRY_ENABLE_ANONYMOUS_AUTH=true`, `AGENT_REGISTRY_ENABLE_REGISTRY_VALIDATION=false`.

#### Scenario: AgentRegistry pod running after sync
- **WHEN** ArgoCD syncs the JAAR chart
- **THEN** the AgentRegistry pod reaches `Running` state with all three ports exposed

#### Scenario: AgentRegistry configured with anonymous auth
- **WHEN** the AgentRegistry pod starts
- **THEN** the API is accessible without authentication and returns valid responses on `/v0/servers`

### Requirement: ClusterIP Service for AgentRegistry
The Helm chart SHALL include a ClusterIP Service named `jaar-agentregistry` exposing port 12121 (HTTP API + Web UI).

#### Scenario: Service routes to AgentRegistry pod
- **WHEN** the chart is synced and the pod is running
- **THEN** `curl http://jaar-agentregistry.jaar:12121/v0/servers` from within the cluster returns a valid JSON response

### Requirement: Bundled PostgreSQL with pgvector
The Helm chart SHALL include a PostgreSQL Deployment with pgvector extension, backed by a PersistentVolumeClaim (5Gi default). The PVC size and PostgreSQL credentials SHALL be configurable via `values.yaml`.

#### Scenario: PostgreSQL PVC provisioned on sync
- **WHEN** ArgoCD syncs the chart on a cluster with a default StorageClass
- **THEN** a PVC is created and bound for PostgreSQL data storage

#### Scenario: PostgreSQL accessible by AgentRegistry
- **WHEN** both PostgreSQL and AgentRegistry pods are running
- **THEN** AgentRegistry connects to PostgreSQL via `AGENT_REGISTRY_DATABASE_URL` and initializes its schema

#### Scenario: Data survives pod restart
- **WHEN** the PostgreSQL pod is deleted and rescheduled
- **THEN** previously registered artifacts are still present in the database

### Requirement: Helm chart structure
The Helm chart SHALL be located at `helm/jaar/` and include `Chart.yaml`, `values.yaml`, and templates for namespace, deployment, service, postgresql, and httproute. Image repository, tag, pullPolicy, replica count, and PostgreSQL PVC size SHALL be configurable via `values.yaml`.

#### Scenario: Chart renders without errors
- **WHEN** `helm template helm/jaar/` is executed
- **THEN** all templates render valid Kubernetes manifests without errors
