## ADDED Requirements

### Requirement: Target GKE cluster is registered to a Fleet
The target GKE cluster SHALL be registered as a member of a GCP Fleet (via Terraform in the infra repo that owns the cluster's other Terraform-managed configuration) before any GKE auto-discovery labels/annotations are relied upon. This is a verified prerequisite, not an assumption.

#### Scenario: Fleet membership exists after Terraform apply
- **WHEN** `gcloud container fleet memberships list --project <project>` is run after the Fleet-registration Terraform is applied
- **THEN** the target cluster appears as a registered membership

### Requirement: MCP server deployment carries GKE auto-discovery labels/annotations
The JARVIS MCP server's Kubernetes Deployment SHALL carry the label `registry.gke.io/functional-type: "AGENT"`, the annotation `a2a-protocol.org/agent-card` pointing at its live Agent Card endpoint URL, and the annotation `iam.gke.io/spiffe-identity-type: agent-identity` for Workload Identity.

#### Scenario: Labels and annotations present on the MCP deployment
- **WHEN** the `jarvis-mcp` Deployment manifest is rendered/applied
- **THEN** its pod template includes `registry.gke.io/functional-type: "AGENT"` as a label and both `a2a-protocol.org/agent-card` and `iam.gke.io/spiffe-identity-type: agent-identity` as annotations

### Requirement: MCP server exposes a live A2A Agent Card endpoint
The MCP server SHALL expose `GET /.well-known/agent-card.json`, returning a valid A2A Agent Card document (name, description, version, skills, and connection interfaces) reachable at the URL referenced by the deployment's `a2a-protocol.org/agent-card` annotation.

#### Scenario: Agent Card endpoint returns valid JSON
- **WHEN** `GET /.well-known/agent-card.json` is requested against the running MCP server
- **THEN** the response is `200 OK` with a JSON body conforming to the A2A Agent Card schema

### Requirement: Registration is empirically verified, not assumed
After Fleet registration and label/annotation deployment, the MCP server's registration with the GCP Agent Registry SHALL be confirmed by querying the Agent Registry API (`projects.locations.mcpServers.list` or `.get`) and observing the deployment listed, rather than treating "labels applied" as sufficient evidence of success.

#### Scenario: MCP server appears in the Agent Registry
- **WHEN** `GET .../mcpServers` is called against the Agent Registry API for the target project/location after auto-discovery has had time to run
- **THEN** the JARVIS MCP server appears in the results

#### Scenario: Registration gap is surfaced, not silently worked around
- **WHEN** the MCP server does not appear in the Agent Registry after a reasonable verification window despite correct labels/annotations and Fleet membership
- **THEN** this is reported as an open blocker (e.g. an additional undocumented prerequisite) rather than assumed to be working or silently abandoned
