# Spec: helm-deployment

## Purpose

Defines the requirements for the Helm chart and ArgoCD Application CRs that deploy the full J.A.R.V.I.S stack onto a Kubernetes cluster, including persistence, service exposure, traffic routing, and configurability.

## Requirements

### Requirement: ArgoCD Application CR deploys the full J.A.R.V.I.S stack
The system SHALL provide ArgoCD `Application` manifests: `argocd/jarvis-app.yaml` (GHCR images) and `argocd/jarvis-app-local.yaml` (local images with overrides). Both target `helm/jarvis/` with `targetRevision: HEAD` and automated sync policy.

#### Scenario: Application syncs successfully on Minikube
- **WHEN** ArgoCD syncs the Application CR against a running Minikube cluster
- **THEN** the release is created, all pods reach `Running` state, and services are accessible via the Istio ingress gateway

#### Scenario: Local deployment uses image overrides
- **WHEN** `make deploy-local` applies the local Application CR
- **THEN** image repositories are overridden to `jarvis-*` with a git-SHA tag and `pullPolicy: Never`

#### Scenario: Application uninstalled via CR deletion
- **WHEN** the ArgoCD Application CR is deleted (e.g., via `make undeploy`)
- **THEN** all Kubernetes resources created by the chart are removed via cascade finalizer

### Requirement: SQLite data persisted via PersistentVolumeClaim
The Helm chart SHALL create a PersistentVolumeClaim for SQLite storage and mount it into the backend pod only.

#### Scenario: PVC provisioned on sync
- **WHEN** ArgoCD syncs the chart on a cluster with a default StorageClass
- **THEN** a PVC is created and bound, and the backend pod mounts it at `/data`

#### Scenario: Data survives pod restart
- **WHEN** the backend pod is deleted and rescheduled
- **THEN** the SQLite database file at `/data/jarvis.db` is intact and no data is lost

### Requirement: Configurable image references and replica counts
The Helm chart SHALL expose image repository, tag, pullPolicy, and replica count as configurable `values.yaml` parameters, overridable via the ArgoCD Application CR's `spec.source.helm.valuesObject`.

#### Scenario: Default values work without overrides
- **WHEN** the Application CR specifies no Helm value overrides
- **THEN** ArgoCD uses the default values from `values.yaml` (GHCR images) and the cluster reaches a healthy state

### Requirement: Services use ClusterIP
Backend and frontend services SHALL use `ClusterIP` type. External access is handled exclusively through the Istio ingress gateway.

#### Scenario: External access via Istio ingress gateway
- **WHEN** `minikube tunnel` is running and the Application has been synced
- **THEN** the Istio ingress gateway LoadBalancer service provides the single external entry point for all application routes

### Requirement: HTTPRoute for path-based routing
The jarvis Helm chart SHALL include a `gateway.networking.k8s.io/v1` HTTPRoute with configurable gateway reference via `values.yaml`.

#### Scenario: API and frontend routing
- **WHEN** traffic arrives at the ingress gateway
- **THEN** `/api/*`, `/docs`, `/openapi.json`, `/health` route to backend; all other paths route to frontend

### Requirement: uv as package manager
The backend SHALL use `uv` as its Python package manager with a `uv.lock` lockfile for reproducible installs.

#### Scenario: Dependencies installed via uv
- **WHEN** `uv sync` is executed in the `backend/` directory
- **THEN** all dependencies are installed into a `.venv` virtual environment

### Requirement: Backend Docker image
The backend SHALL be packaged as a Docker image built from `backend/Dockerfile`, using `uv sync --frozen` for dependency installation.

#### Scenario: Image builds successfully
- **WHEN** `docker build -t jarvis-backend ./backend` is executed
- **THEN** the build completes without error and produces a runnable image

#### Scenario: Container runs without root privileges
- **WHEN** the Docker container is started
- **THEN** the process runs as a non-root user (UID >= 1000)
