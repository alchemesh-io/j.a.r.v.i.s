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

### Requirement: Services use ClusterIP
Backend and frontend services SHALL use `ClusterIP` type. External access is handled exclusively through the Istio ingress gateway.

#### Scenario: No LoadBalancer on application services
- **WHEN** the jarvis Helm chart is synced
- **THEN** backend and frontend services are of type `ClusterIP`

#### Scenario: External access via ingress gateway
- **WHEN** `minikube tunnel` is running
- **THEN** the Istio ingress gateway service receives an `EXTERNAL-IP` and all application routes are accessible through it

### Requirement: Frontend serves static files only
The frontend container SHALL serve static files using `serve` (no nginx, no reverse proxy). All API routing is handled by Istio at the mesh level.

#### Scenario: Frontend has no proxy configuration
- **WHEN** the frontend container starts
- **THEN** it serves the built SPA files on port 80 with SPA fallback routing, with no backend proxy configuration
