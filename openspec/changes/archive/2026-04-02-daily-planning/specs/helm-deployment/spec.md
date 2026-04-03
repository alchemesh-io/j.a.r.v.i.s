## ADDED Requirements

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

### Requirement: HTTPRoute for path-based routing
The jarvis Helm chart SHALL include a `gateway.networking.k8s.io/v1` HTTPRoute that routes traffic from the Istio ingress gateway. The gateway name and namespace SHALL be configurable via `values.yaml`.

#### Scenario: API traffic routed to backend
- **WHEN** a request to `/api/`, `/docs`, `/openapi.json`, or `/health` arrives
- **THEN** the HTTPRoute directs it to the backend service

#### Scenario: Frontend catch-all route
- **WHEN** a request to any other path arrives
- **THEN** the HTTPRoute directs it to the frontend service

### Requirement: Separate ArgoCD Application CRs for local and remote deployment
The system SHALL provide `argocd/jarvis-app.yaml` (uses default `values.yaml` with GHCR images) and `argocd/jarvis-app-local.yaml` (overrides image repositories to `jarvis-*:local` with `pullPolicy: Never`).

#### Scenario: Local deployment uses local images
- **WHEN** `make deploy-local` is executed
- **THEN** the local Application CR is applied with image overrides and a git-SHA-based tag

## MODIFIED Requirements

### Requirement: SQLite data persisted via PersistentVolumeClaim
The Helm chart SHALL create a PersistentVolumeClaim for SQLite storage and mount it into the backend pod only. The MCP server does not need direct database access as it communicates with the backend via REST API.

#### Scenario: PVC provisioned on sync
- **WHEN** ArgoCD syncs the chart on a cluster with a default StorageClass
- **THEN** a PVC is created and bound, and the backend pod mounts it at `/data`

### Requirement: Services use ClusterIP
Backend and frontend services SHALL use `ClusterIP` type. External access is handled by the Istio ingress gateway.

#### Scenario: No direct LoadBalancer on app services
- **WHEN** the chart is synced
- **THEN** backend and frontend services are `ClusterIP`
