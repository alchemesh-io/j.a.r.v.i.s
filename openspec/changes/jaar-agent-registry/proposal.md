## Why

J.A.R.V.I.S needs a centralized registry for managing AI building blocks (MCP servers, agents, skills, prompts). As the platform grows beyond task management, tracking and governing these artifacts becomes essential. AgentRegistry is an open-source registry platform that provides exactly this capability, and deploying it now establishes the foundation for J.A.W (Just A Worker) to pull artifacts at runtime in the future.

## What Changes

- Deploy AgentRegistry (`ghcr.io/agentregistry-dev/agentregistry:server` v0.2.1) in a dedicated `jaar` Kubernetes namespace with bundled PostgreSQL + pgvector
- Add a new Helm chart (`helm/jaar/`) and ArgoCD Application CRs for the registry
- Restructure Istio Gateway routing: move JARVIS under `/jarvis/*` prefix and expose JAAR under `/jaar/*`, using URL rewrite filters to strip prefixes
- Update the frontend to work under the `/jarvis/` base path (vite config, router basename, API client)
- Add an "Agent Registry" dashboard card showing artifact counts (servers, agents, skills, prompts) fetched directly from the JAAR API
- Create an `artifacts/` directory with one folder per artifact type (`servers/`, `agents/`, `skills/`, `prompts/`), each containing its own manifest and source files. The existing JARVIS MCP server will be relocated under `artifacts/servers/jarvis-mcp/`
- Add a CI pipeline to build and publish artifacts to GHCR, then register them with AgentRegistry

## Capabilities

### New Capabilities
- `jaar-deployment`: Helm chart, ArgoCD CRs, namespace, and PostgreSQL for deploying AgentRegistry as a standalone service
- `jaar-gateway-routing`: HTTPRoute configuration for `/jaar/*` prefix with URL rewrite, plus restructuring existing JARVIS routes under `/jarvis/*`
- `jaar-dashboard-card`: Dashboard UI card displaying artifact counts from the JAAR API with a link to the registry UI
- `jaar-artifacts-ci`: Repository structure with one folder per artifact type, relocation of JARVIS MCP server under `artifacts/servers/`, and CI pipeline to publish artifacts to GHCR and register with AgentRegistry

### Modified Capabilities
- `istio-traffic`: Gateway routing changes from catch-all patterns to prefixed paths (`/jarvis/*`, `/jaar/*`) with URL rewrite filters; root `/` becomes a redirect to `/jarvis`
- `helm-deployment`: Makefile updates for JAAR image build/load targets and potential `MINIKUBE_MEMORY` bump
- `jarvis-dashboard`: New Agent Registry card added to the dashboard page
- `frontend-app`: Base path changes (`/jarvis/` prefix) affecting vite config, router, and API client

## Impact

- **Infrastructure**: New `jaar` namespace with its own Helm chart, ArgoCD app, PostgreSQL PVC, and Istio sidecar injection
- **Routing**: All existing JARVIS URLs shift from `/*` to `/jarvis/*` -- bookmarks and any external integrations referencing old paths will break (**BREAKING**)
- **Frontend**: Base path, router basename, and API client URL all change to accommodate the `/jarvis/` prefix
- **MCP Server**: Relocated from `mcp_server/` to `artifacts/servers/jarvis-mcp/`; Helm chart and Dockerfile paths updated accordingly
- **Backend**: No changes -- continues serving on `/api/v1/*`, gateway handles prefix stripping
- **CI/CD**: New workflow for artifact publishing; existing `docker-publish.yml` unchanged
- **Resource usage**: PostgreSQL + AgentRegistry adds ~512 MB RAM overhead; may require bumping `MINIKUBE_MEMORY`
