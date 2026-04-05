## MODIFIED Requirements

### Requirement: Sidecar injection for application namespace
The `jarvis` and `jaar` namespaces SHALL be labeled for automatic Istio sidecar injection. All application pods in both namespaces SHALL receive an Envoy sidecar proxy.

#### Scenario: Namespace labeled for injection
- **WHEN** the `jarvis` and `jaar` namespaces exist
- **THEN** both have the label `istio-injection=enabled`

#### Scenario: Application pods receive sidecar
- **WHEN** application pods start in the `jarvis` or `jaar` namespace
- **THEN** each pod has an `istio-proxy` sidecar container injected automatically

### Requirement: HTTPRoute for path-based routing
The jarvis Helm chart SHALL include an `HTTPRoute` resource that routes traffic from the Istio ingress gateway to backend and frontend services using `/jarvis` prefix-based path matching with URL rewrite filters to strip the prefix. A root redirect from `/` to `/jarvis` SHALL be included.

#### Scenario: API requests routed to backend via /jarvis prefix
- **WHEN** a request to `/jarvis/api/`, `/jarvis/docs`, `/jarvis/openapi.json`, or `/jarvis/health` arrives at the ingress gateway
- **THEN** the HTTPRoute rewrites the path to strip the `/jarvis` prefix (e.g., `/jarvis/api/v1/tasks` becomes `/api/v1/tasks`) and routes to the backend service

#### Scenario: Frontend requests routed via /jarvis prefix
- **WHEN** a request to `/jarvis` or `/jarvis/*` (not matching API paths) arrives at the ingress gateway
- **THEN** the HTTPRoute rewrites the path to strip the `/jarvis` prefix and routes to the frontend service

#### Scenario: Root redirect to /jarvis
- **WHEN** a request to `/` (exact match) arrives at the ingress gateway
- **THEN** the HTTPRoute responds with a redirect to `/jarvis`

#### Scenario: HTTPRoute references configurable gateway
- **WHEN** the jarvis Helm chart is rendered
- **THEN** the HTTPRoute's `parentRefs` gateway name and namespace are configurable via `values.yaml`

## ADDED Requirements

### Requirement: Local dev cluster includes jaar namespace setup
The `make cluster-up` target SHALL label the `jaar` namespace for Istio sidecar injection alongside the existing `jarvis` namespace setup.

#### Scenario: Cluster setup labels both namespaces
- **WHEN** `make cluster-up` completes
- **THEN** both `jarvis` and `jaar` namespaces have the `istio-injection=enabled` label
