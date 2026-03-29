## ADDED Requirements

### Requirement: Istio service mesh deployed via ArgoCD
The system SHALL deploy Istio and Gateway API CRDs via a single multi-source ArgoCD Application CR (`argocd/istio-app.yaml`). Gateway API CRDs are sourced from `github.com/kubernetes-sigs/gateway-api` (v1.5.1), and the Istio Helm chart from `helm/istio/` (base + istiod sub-charts, v1.26.1).

#### Scenario: Istio installed during cluster setup
- **WHEN** `make cluster-up` is executed
- **THEN** the Istio ArgoCD Application is applied and istiod reaches `Running` state

### Requirement: Kubernetes Gateway API for ingress routing
The system SHALL use `gateway.networking.k8s.io/v1` Gateway and HTTPRoute resources with `gatewayClassName: istio`. The Gateway is deployed in `istio-system` by the Istio Helm chart. The HTTPRoute is deployed in `jarvis` namespace by the jarvis Helm chart.

#### Scenario: Path-based routing via HTTPRoute
- **WHEN** traffic arrives at the ingress gateway
- **THEN** `/api/*`, `/docs`, `/openapi.json`, `/health` route to the backend; all other paths route to the frontend

#### Scenario: Gateway reference configurable in jarvis chart
- **WHEN** the jarvis Helm chart values set `gateway.name` and `gateway.namespace`
- **THEN** the HTTPRoute's `parentRefs` use those values

### Requirement: Frontend static-only serving
The frontend container SHALL use `serve` for static file serving. No nginx, no reverse proxy. Istio handles all API routing at the mesh level.

#### Scenario: No nginx in the stack
- **WHEN** the frontend Docker image is built
- **THEN** it uses `node:22-alpine` with `serve` — no nginx image or configuration

## MODIFIED Requirements

### Requirement: Services use ClusterIP instead of LoadBalancer
Backend and frontend services SHALL be `ClusterIP`. External access is through the Istio ingress gateway only.

#### Scenario: Access via Istio ingress
- **WHEN** `minikube tunnel` is running
- **THEN** the Istio ingress gateway LoadBalancer service provides the single external entry point

### Requirement: Local dev cluster includes Istio
The `make cluster-up` target SHALL install Istio before ArgoCD setup, label the `jarvis` namespace for sidecar injection, and wait for Istio to become healthy.

#### Scenario: Cluster setup order
- **WHEN** `make cluster-up` completes
- **THEN** Istio is installed, `jarvis` namespace is labeled with `istio-injection=enabled`, ArgoCD is installed, and the repo is configured
