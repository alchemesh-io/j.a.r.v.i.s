# Spec: jaar-deployment

## Purpose

Defines the requirements for deploying JAAR (Just An Agent Registry) via Helm and ArgoCD, including the upstream AgentRegistry subchart, PostgreSQL, secrets management, and namespace setup.

## Requirements

### Requirement: ArgoCD Application CRs for JAAR
The system SHALL provide ArgoCD `Application` manifests: `argocd/jaar-app.yaml` (GHCR images) and `argocd/jaar-app-local.yaml` (local). Both SHALL target `helm/jaar/` with `targetRevision: HEAD` and automated sync policy.

#### Scenario: JAAR application syncs successfully on Minikube
- **WHEN** ArgoCD syncs the JAAR Application CR against a running Minikube cluster
- **THEN** the release is created, all JAAR pods reach `Running` state, and the AgentRegistry HTTP API is accessible on port 12121

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

### Requirement: AgentRegistry via upstream Helm subchart
The JAAR Helm chart SHALL depend on the official `agentregistry` chart (`oci://ghcr.io/agentregistry-dev/agentregistry/charts` v0.3.3) as a subchart dependency. The upstream chart provides the AgentRegistry deployment, service, and bundled PostgreSQL. Configuration is passed via the `agentregistry` key in `values.yaml`: image tag `v0.3.3`, anonymous auth enabled, registry validation disabled. JWT signing key SHALL be stored in the `jaar-secret` K8s Secret (referenced via `config.existingSecret`).

#### Scenario: AgentRegistry pod running after sync
- **WHEN** ArgoCD syncs the JAAR chart
- **THEN** the AgentRegistry pod reaches `Running` state with HTTP (12121), gRPC (21212), and MCP (31313) ports exposed

#### Scenario: AgentRegistry configured with anonymous auth
- **WHEN** the AgentRegistry pod starts
- **THEN** the API is accessible without authentication and returns valid responses on `/v0/servers`

### Requirement: ClusterIP Service for AgentRegistry
The upstream subchart SHALL provide a ClusterIP Service named `jaar-agentregistry` exposing port 12121 (HTTP API + Web UI).

#### Scenario: Service routes to AgentRegistry pod
- **WHEN** the chart is synced and the pod is running
- **THEN** `curl http://jaar-agentregistry.jaar:12121/v0/servers` from within the cluster returns a valid JSON response

### Requirement: Bundled PostgreSQL
The upstream subchart SHALL provide a bundled PostgreSQL instance backed by a PVC (5Gi default). The bundled database is for local dev only. For production, set `agentregistry.database.postgres.bundled.enabled=false` and provide the connection URL via the `jaar-secret` K8s Secret.

#### Scenario: PostgreSQL PVC provisioned on sync
- **WHEN** ArgoCD syncs the chart on a cluster with a default StorageClass
- **THEN** a PVC is created and bound for PostgreSQL data storage

#### Scenario: PostgreSQL accessible by AgentRegistry
- **WHEN** both PostgreSQL and AgentRegistry pods are running
- **THEN** AgentRegistry connects to PostgreSQL and initializes its schema

### Requirement: JAAR secrets management
Credentials SHALL be stored in a gitignored `secrets/jaar-secret.yaml` K8s Secret manifest (namespace `jaar`). A template is provided at `secrets/jaar-secret.example.yaml` containing the JWT signing key and optional external database URL. The Makefile `_deploy-jaar-secrets` target applies this secret before deployment.

#### Scenario: Secret applied on deploy
- **WHEN** `make deploy` or `make deploy-local` is executed
- **THEN** the `jaar-secret` K8s Secret is applied to the `jaar` namespace

### Requirement: Helm chart structure
The Helm chart SHALL be located at `helm/jaar/` with `Chart.yaml` (upstream subchart dependency), `values.yaml`, and templates for `namespace.yaml` and `httproute.yaml`. All deployment, service, and PostgreSQL resources are provided by the upstream subchart.

#### Scenario: Chart renders without errors
- **WHEN** `helm template helm/jaar/` is executed
- **THEN** all templates render valid Kubernetes manifests without errors
