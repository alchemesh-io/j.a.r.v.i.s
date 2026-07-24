## ADDED Requirements

### Requirement: MCP server exposes an A2A Agent Card endpoint
The JARVIS MCP server (`artifacts/servers/jarvis`) SHALL expose an HTTP endpoint at `/.well-known/agent-card.json` returning an A2A-protocol-compliant Agent Card describing the server (name, description, capabilities).

#### Scenario: Agent Card reachable over HTTP
- **WHEN** a `GET` request is made to the MCP server's `/.well-known/agent-card.json` path
- **THEN** the response is a `200` with a JSON body conforming to the A2A Agent Card schema

### Requirement: GKE deployment carries Agent Registry auto-discovery label and annotation
The Kubernetes Deployment for the MCP server SHALL carry the label `registry.gke.io/functional-type: "AGENT"` and the annotation `a2a-protocol.org/agent-card` pointing at the Agent Card endpoint's path and port, so that Gemini Enterprise Agent Registry can perform its introspection scan.

#### Scenario: Deployment labeled for introspection
- **WHEN** the MCP server Deployment manifest is rendered
- **THEN** its metadata includes `registry.gke.io/functional-type: "AGENT"` and an `a2a-protocol.org/agent-card` annotation referencing `/.well-known/agent-card.json`

### Requirement: Pod template carries Workload Identity agent-identity annotation
The MCP server pod template SHALL carry the annotation `iam.gke.io/spiffe-identity-type: agent-identity` to support Workload-Identity-based agent registration.

#### Scenario: Pod template annotated for agent identity
- **WHEN** the MCP server Deployment manifest is rendered
- **THEN** its pod template metadata includes `iam.gke.io/spiffe-identity-type: agent-identity`
