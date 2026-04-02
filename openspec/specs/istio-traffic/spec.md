# Spec: istio-traffic

## Purpose

Defines the requirements for Istio service mesh deployment, Gateway API ingress routing, and traffic management for the J.A.R.V.I.S platform.

## Requirements

### Requirement: Istio service mesh deployed via ArgoCD
The system SHALL deploy Istio (base + istiod) and Gateway API CRDs via a single ArgoCD Application CR using multi-source configuration. The Istio Helm chart SHALL be located at `helm/istio/` with sub-chart dependencies on the official Istio Helm charts.

#### Scenario: Istio installed during cluster setup
- **WHEN** `make cluster-up` is executed
- **THEN** the ArgoCD Application for Istio is applied, Gateway API CRDs are installed from the official GitHub repository, and istiod reaches `Running` state in the `istio-system` namespace

#### Scenario: Istio ArgoCD Application uses multi-source
- **WHEN** the Istio ArgoCD Application is synced
- **THEN** it deploys both the Gateway API CRDs (from `github.com/kubernetes-sigs/gateway-api`) and the Istio Helm chart (from `helm/istio/`) as two sources in a single Application

### Requirement: Sidecar injection for application namespace
The `jarvis` namespace SHALL be labeled for automatic Istio sidecar injection. All application pods (backend, frontend, MCP) SHALL receive an Envoy sidecar proxy.

#### Scenario: Namespace labeled for injection
- **WHEN** the `jarvis` namespace exists
- **THEN** it has the label `istio-injection=enabled`

#### Scenario: Application pods receive sidecar
- **WHEN** application pods start in the `jarvis` namespace
- **THEN** each pod has an `istio-proxy` sidecar container injected automatically

### Requirement: Kubernetes Gateway API for ingress
The system SHALL use the Kubernetes Gateway API (`gateway.networking.k8s.io/v1`) with Istio as the implementation. A `Gateway` resource SHALL be deployed in the `istio-system` namespace with `gatewayClassName: istio`, and Istio SHALL auto-provision the ingress gateway pod.

#### Scenario: Gateway resource provisioned
- **WHEN** the Istio Helm chart is synced
- **THEN** a `Gateway` resource named `jarvis-gateway` exists in `istio-system` listening on port 80

#### Scenario: Ingress gateway pod auto-provisioned
- **WHEN** the Gateway resource is created
- **THEN** Istio automatically creates an ingress gateway Deployment and LoadBalancer Service in `istio-system`

### Requirement: HTTPRoute for path-based routing
The jarvis Helm chart SHALL include an `HTTPRoute` resource that routes traffic from the Istio ingress gateway to backend and frontend services based on URL path.

#### Scenario: API requests routed to backend
- **WHEN** a request to `/api/`, `/docs`, `/openapi.json`, or `/health` arrives at the ingress gateway
- **THEN** it is routed to the backend service

#### Scenario: All other requests routed to frontend
- **WHEN** a request to any other path arrives at the ingress gateway
- **THEN** it is routed to the frontend service (SPA catch-all)

#### Scenario: HTTPRoute references configurable gateway
- **WHEN** the jarvis Helm chart is rendered
- **THEN** the HTTPRoute's `parentRefs` gateway name and namespace are configurable via `values.yaml`

### Requirement: Services use ClusterIP instead of LoadBalancer
Backend and frontend services SHALL be `ClusterIP`. External access is through the Istio ingress gateway only.

#### Scenario: No LoadBalancer on application services
- **WHEN** the jarvis Helm chart is synced
- **THEN** backend and frontend services are of type `ClusterIP`

#### Scenario: Access via Istio ingress
- **WHEN** `minikube tunnel` is running
- **THEN** the Istio ingress gateway LoadBalancer service provides the single external entry point

#### Scenario: External access via ingress gateway
- **WHEN** `minikube tunnel` is running
- **THEN** the Istio ingress gateway service receives an `EXTERNAL-IP` and all application routes are accessible through it

### Requirement: Frontend static-only serving
The frontend container SHALL use `serve` for static file serving. No nginx, no reverse proxy. Istio handles all API routing at the mesh level.

#### Scenario: No nginx in the stack
- **WHEN** the frontend Docker image is built
- **THEN** it uses `node:22-alpine` with `serve` — no nginx image or configuration

#### Scenario: Frontend has no proxy configuration
- **WHEN** the frontend container starts
- **THEN** it serves the built SPA files on port 80 with SPA fallback routing, with no backend proxy configuration

### Requirement: Local dev cluster includes Istio
The `make cluster-up` target SHALL install Istio before ArgoCD setup, label the `jarvis` namespace for sidecar injection, and wait for Istio to become healthy.

#### Scenario: Cluster setup order
- **WHEN** `make cluster-up` completes
- **THEN** Istio is installed, `jarvis` namespace is labeled with `istio-injection=enabled`, ArgoCD is installed, and the repo is configured
