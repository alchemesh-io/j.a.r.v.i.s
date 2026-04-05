## ADDED Requirements

### Requirement: HTTPRoute for JAAR in jaar namespace
The `helm/jaar/` chart SHALL include a `gateway.networking.k8s.io/v1` HTTPRoute in the `jaar` namespace, attached to the shared Istio Gateway via `parentRefs`. The gateway name and namespace SHALL be configurable via `values.yaml`.

#### Scenario: HTTPRoute references shared gateway
- **WHEN** the JAAR Helm chart is rendered
- **THEN** the HTTPRoute's `parentRefs` references the same Gateway used by the JARVIS HTTPRoute (default: `jarvis-gateway` in `istio-system`)

### Requirement: URL rewrite strips /jaar prefix
The JAAR HTTPRoute SHALL match requests with path prefix `/jaar` and apply a `URLRewrite` filter that strips the `/jaar` prefix before forwarding to the `jaar-agentregistry` service on port 12121.

#### Scenario: AgentRegistry API accessible via /jaar prefix
- **WHEN** a request to `/jaar/v0/servers` arrives at the ingress gateway
- **THEN** the HTTPRoute rewrites the path to `/v0/servers` and forwards to `jaar-agentregistry:12121`

#### Scenario: AgentRegistry Web UI accessible via /jaar prefix
- **WHEN** a request to `/jaar` arrives at the ingress gateway
- **THEN** the HTTPRoute rewrites the path to `/` and forwards to `jaar-agentregistry:12121`, serving the Next.js UI

#### Scenario: AgentRegistry sees clean paths
- **WHEN** the AgentRegistry service receives a request forwarded by the gateway
- **THEN** the request path does not contain the `/jaar` prefix
