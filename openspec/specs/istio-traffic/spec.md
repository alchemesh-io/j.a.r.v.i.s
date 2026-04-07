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
The `jarvis` and `jaar` namespaces SHALL be labeled for automatic Istio sidecar injection. All application pods in both namespaces SHALL receive an Envoy sidecar proxy.

#### Scenario: Namespace labeled for injection
- **WHEN** the `jarvis` and `jaar` namespaces exist
- **THEN** both have the label `istio-injection=enabled`

#### Scenario: Application pods receive sidecar
- **WHEN** application pods start in the `jarvis` or `jaar` namespace
- **THEN** each pod has an `istio-proxy` sidecar container injected automatically

### Requirement: Gateway with HTTP and HTTPS listeners
The Istio Helm chart SHALL include a Gateway resource with two listeners: an HTTP listener on port 80 (no hostname restriction, for localhost support) and an HTTPS listener on port 443 matching `*.jarvis.io` with TLS termination using a self-signed wildcard certificate.

#### Scenario: HTTP listener accepts all hostnames
- **WHEN** an HTTP request arrives on port 80 with any hostname
- **THEN** the gateway accepts the request and delegates to HTTPRoutes for host matching

#### Scenario: HTTPS listener terminates TLS for *.jarvis.io
- **WHEN** an HTTPS request arrives on port 443 for a `*.jarvis.io` hostname
- **THEN** the gateway terminates TLS using the `jarvis-io-tls` secret and forwards to the matched HTTPRoute

### Requirement: Host-based HTTPRoute for JARVIS
The jarvis Helm chart SHALL include an HTTPRoute resource that routes traffic based on hostname (`main.jarvis.io` and `localhost`) to backend and frontend services using simple path matching — no prefix stripping or URL rewrite needed.

#### Scenario: API requests routed to backend
- **WHEN** a request to `/api/`, `/docs`, `/openapi.json`, or `/health` arrives with host `main.jarvis.io` or `localhost`
- **THEN** the HTTPRoute routes to the backend service

#### Scenario: Frontend requests routed via catch-all
- **WHEN** a request to `/` or any path not matching API routes arrives with host `main.jarvis.io` or `localhost`
- **THEN** the HTTPRoute routes to the frontend service

#### Scenario: HTTPRoute references configurable gateway and hostname
- **WHEN** the jarvis Helm chart is rendered
- **THEN** the HTTPRoute's `parentRefs` gateway name/namespace and hostname are configurable via `values.yaml`

### Requirement: Host-based HTTPRoute for MCP server
The jarvis Helm chart SHALL include an HTTPRoute resource routing `mcp.jarvis.io` traffic to the MCP server service.

#### Scenario: MCP requests routed to MCP server
- **WHEN** a request arrives with host `mcp.jarvis.io`
- **THEN** the HTTPRoute routes to the MCP server service on port 8080

### Requirement: ArgoCD accessible via HTTPS on jaac.jarvis.io
The Istio Helm chart SHALL include an HTTPRoute for `jaac.jarvis.io` attached to the HTTPS listener, routing to `argocd-server:80`. An HTTP→HTTPS redirect SHALL be included for the same hostname.

#### Scenario: ArgoCD UI accessible via HTTPS
- **WHEN** a request to `https://jaac.jarvis.io` arrives
- **THEN** the HTTPRoute forwards to `argocd-server:80` (ArgoCD runs in insecure mode, TLS terminated at gateway)

#### Scenario: HTTP redirects to HTTPS for ArgoCD
- **WHEN** a request to `http://jaac.jarvis.io` arrives
- **THEN** the HTTPRoute responds with a 301 redirect to `https://jaac.jarvis.io`

### Requirement: Self-signed TLS certificate for *.jarvis.io
The `make cluster-up` target SHALL generate a self-signed wildcard certificate for `*.jarvis.io` and store it as a K8s TLS secret `jarvis-io-tls` in `istio-system`.

#### Scenario: TLS secret created on cluster setup
- **WHEN** `make cluster-up` runs and no `jarvis-io-tls` secret exists
- **THEN** a self-signed cert with proper key usage extensions is generated and stored

### Requirement: ArgoCD insecure mode for gateway TLS termination
The `_argocd-install` Makefile target SHALL configure ArgoCD server with `server.insecure=true` so it does not perform its own TLS redirect (the gateway handles TLS termination).

#### Scenario: ArgoCD serves HTTP behind gateway
- **WHEN** ArgoCD is installed via `make cluster-up`
- **THEN** the `argocd-cmd-params-cm` ConfigMap has `server.insecure=true` and the server is restarted

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

### Requirement: Local dev cluster includes jaar namespace setup
The `make cluster-up` target SHALL label the `jaar` namespace for Istio sidecar injection alongside the existing `jarvis` namespace setup.

#### Scenario: Cluster setup labels both namespaces
- **WHEN** `make cluster-up` completes
- **THEN** both `jarvis` and `jaar` namespaces have the `istio-injection=enabled` label
