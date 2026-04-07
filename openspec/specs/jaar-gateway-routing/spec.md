# Spec: jaar-gateway-routing

## Purpose

Defines the requirements for HTTPRoute-based gateway routing for the JAAR (Agent Registry) service, enabling host-based access via the shared Istio ingress gateway.

## Requirements

### Requirement: Host-based HTTPRoute for JAAR in jaar namespace
The `helm/jaar/` chart SHALL include a `gateway.networking.k8s.io/v1` HTTPRoute in the `jaar` namespace, attached to the shared Istio Gateway via `parentRefs`. The gateway name, namespace, and hostname SHALL be configurable via `values.yaml`. The route SHALL use host-based matching (default: `jaar.jarvis.io`) with no URL rewrite — AgentRegistry receives requests at the root path.

#### Scenario: HTTPRoute references shared gateway
- **WHEN** the JAAR Helm chart is rendered
- **THEN** the HTTPRoute's `parentRefs` references the same Gateway used by the JARVIS HTTPRoute (default: `jarvis-gateway` in `istio-system`)

#### Scenario: AgentRegistry API accessible via jaar.jarvis.io
- **WHEN** a request to `http://jaar.jarvis.io/v0/servers` arrives at the ingress gateway
- **THEN** the HTTPRoute forwards to `jaar-agentregistry:12121` with the path unchanged

#### Scenario: AgentRegistry Web UI accessible via jaar.jarvis.io
- **WHEN** a request to `http://jaar.jarvis.io/` arrives at the ingress gateway
- **THEN** the HTTPRoute forwards to `jaar-agentregistry:12121`, serving the Next.js UI with all assets (`/_next/static/*`) working natively

#### Scenario: AgentRegistry sees clean paths
- **WHEN** the AgentRegistry service receives a request forwarded by the gateway
- **THEN** the request path is unmodified (no prefix stripping needed with host-based routing)
