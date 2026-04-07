# Spec: helm-deployment

## Purpose

Defines the requirements for the Helm chart and ArgoCD Application CRs that deploy the full J.A.R.V.I.S stack onto a Kubernetes cluster, including persistence, service exposure, traffic routing, and configurability.

## Requirements

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

### Requirement: SQLite data persisted via PersistentVolumeClaim
The Helm chart SHALL create a PersistentVolumeClaim for SQLite storage and mount it into the backend pod only. The MCP server does not need direct database access as it communicates with the backend via REST API.

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
Backend and frontend services SHALL use `ClusterIP` type. External access is handled by the Istio ingress gateway.

#### Scenario: No direct LoadBalancer on app services
- **WHEN** the chart is synced
- **THEN** backend and frontend services are `ClusterIP`

#### Scenario: External access via Istio ingress gateway
- **WHEN** `minikube tunnel` is running and the Application has been synced
- **THEN** the Istio ingress gateway LoadBalancer service provides the single external entry point for all application routes

### Requirement: HTTPRoute for path-based routing
The jarvis Helm chart SHALL include a `gateway.networking.k8s.io/v1` HTTPRoute that routes traffic from the Istio ingress gateway. The gateway name and namespace SHALL be configurable via `values.yaml`.

#### Scenario: API traffic routed to backend
- **WHEN** a request to `/api/`, `/docs`, `/openapi.json`, or `/health` arrives
- **THEN** the HTTPRoute directs it to the backend service

#### Scenario: Frontend catch-all route
- **WHEN** a request to any other path arrives
- **THEN** the HTTPRoute directs it to the frontend service

### Requirement: Backend ConfigMap for application configuration
The Helm chart SHALL create a ConfigMap containing environment variables for the backend, including `DATABASE_URL` and any application-specific configuration. The ConfigMap values SHALL be configurable via `values.yaml`.

#### Scenario: ConfigMap created on sync
- **WHEN** ArgoCD syncs the chart
- **THEN** a ConfigMap with backend configuration keys is created in the `jarvis` namespace

#### Scenario: Backend pod uses ConfigMap
- **WHEN** the backend pod starts
- **THEN** environment variables from the ConfigMap are injected into the container

### Requirement: Backend Secret for sensitive configuration
The Helm chart SHALL create a Secret for sensitive backend configuration (e.g., future database credentials). The Secret values SHALL be configurable via `values.yaml` with base64 encoding.

#### Scenario: Secret created on sync
- **WHEN** ArgoCD syncs the chart
- **THEN** a Secret with sensitive configuration is created in the `jarvis` namespace

### Requirement: MCP server deployment
The Helm chart SHALL include a Deployment and Service for the MCP server as a standalone pod, with its own image reference, replica count, and environment variables configurable via `values.yaml`. The MCP server SHALL receive a `BACKEND_URL` environment variable pointing to the backend service (e.g., `http://jarvis-backend:8000`). The MCP server SHALL NOT mount the SQLite PVC.

#### Scenario: MCP server pod running after sync
- **WHEN** ArgoCD syncs the chart
- **THEN** the MCP server pod reaches `Running` state

#### Scenario: MCP server configured with backend URL
- **WHEN** the MCP server pod starts
- **THEN** it has a `BACKEND_URL` environment variable pointing to the backend Kubernetes service

### Requirement: Separate ArgoCD Application CRs for local and remote deployment
The system SHALL provide `argocd/jarvis-app.yaml` (uses default `values.yaml` with GHCR images) and `argocd/jarvis-app-local.yaml` (overrides image repositories to `jarvis-*:local` with `pullPolicy: Never`).

#### Scenario: Local deployment uses local images
- **WHEN** `make deploy-local` is executed
- **THEN** the local Application CR is applied with image overrides and a git-SHA-based tag

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
