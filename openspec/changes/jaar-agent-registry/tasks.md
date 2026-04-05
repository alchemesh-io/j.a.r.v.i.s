## 1. JAAR Helm Chart (Chunk 1)

- [ ] 1.1 Create `helm/jaar/Chart.yaml` with chart metadata and pinned upstream AgentRegistry version
- [ ] 1.2 Create `helm/jaar/values.yaml` with configurable image, tag, pullPolicy, replica count, PostgreSQL PVC size, and gateway reference
- [ ] 1.3 Create `helm/jaar/templates/namespace.yaml` — `jaar` namespace with `istio-injection: enabled` label
- [ ] 1.4 Create `helm/jaar/templates/postgresql.yaml` — PostgreSQL + pgvector Deployment and PVC (5Gi default)
- [ ] 1.5 Create `helm/jaar/templates/deployment.yaml` — AgentRegistry pod (`ghcr.io/agentregistry-dev/agentregistry:server:0.2.1`), ports 12121/21212/31313, env vars for DB URL, anonymous auth, and validation
- [ ] 1.6 Create `helm/jaar/templates/service.yaml` — ClusterIP service `jaar-agentregistry` on port 12121

## 2. JAAR ArgoCD Applications (Chunk 1)

- [ ] 2.1 Create `argocd/jaar-app.yaml` — ArgoCD Application CR targeting `helm/jaar/` with GHCR images and automated sync
- [ ] 2.2 Create `argocd/jaar-app-local.yaml` — Local variant with image overrides and `pullPolicy: Never`
- [ ] 2.3 Update `Makefile` — Add JAAR image build/load targets, update `deploy-local` to apply JAAR Application CR, update `undeploy` to delete JAAR CR

## 3. Istio Gateway Routing Restructure (Chunk 2)

- [ ] 3.1 Update `helm/jarvis/templates/httproute.yaml` — Change rules to `/jarvis/api/*` with URLRewrite stripping `/jarvis` prefix, `/jarvis/*` catch-all to frontend with prefix strip, and `/` exact redirect to `/jarvis`
- [ ] 3.2 Create `helm/jaar/templates/httproute.yaml` — `/jaar/*` prefix match with URLRewrite to strip prefix, forwarding to `jaar-agentregistry:12121`
- [ ] 3.3 Update `Makefile` `cluster-up` target — Label `jaar` namespace for Istio sidecar injection alongside `jarvis`

## 4. Frontend Base Path Changes (Chunk 2)

- [ ] 4.1 Update `frontend/vite.config.ts` — Set `base: '/jarvis/'`
- [ ] 4.2 Update `frontend/src/App.tsx` — Add `basename="/jarvis"` to `<BrowserRouter>`
- [ ] 4.3 Update `frontend/src/api/client.ts` — Change `API_BASE` to `'/jarvis/api/v1'`
- [ ] 4.4 Update `frontend/vite.config.ts` dev proxy — Adjust proxy paths for `/jarvis/api` prefix

## 5. MCP Server Relocation (Chunk 2)

- [ ] 5.1 Create `artifacts/servers/` directory and move `mcp_server/` contents to `artifacts/servers/jarvis-mcp/`
- [ ] 5.2 Create `artifacts/servers/jarvis-mcp/manifest.yaml` with artifact metadata
- [ ] 5.3 Update `helm/jarvis/values.yaml` — Change MCP image build context path to `artifacts/servers/jarvis-mcp/`
- [ ] 5.4 Update `helm/jarvis/templates/mcp-deployment.yaml` — Verify Dockerfile path references
- [ ] 5.5 Update `.github/workflows/docker-publish.yml` — Change MCP server build context to new path
- [ ] 5.6 Update `Makefile` — Change MCP image build path for `deploy-local`
- [ ] 5.7 Run MCP server tests from new location to verify nothing broke

## 6. Dashboard Agent Registry Card (Chunk 3)

- [ ] 6.1 Create `frontend/src/api/jaar.ts` — Typed API client with functions for fetching servers, agents, skills, prompts from `/jaar/v0/*`
- [ ] 6.2 Create Agent Registry card component — Display four artifact type rows with counts, "Open Registry" link to `/jaar`
- [ ] 6.3 Integrate card into Dashboard page — Add to existing grid layout with drag-and-drop and compact mode support
- [ ] 6.4 Add TanStack Query hooks for JAAR API calls with caching
- [ ] 6.5 Handle error/loading states — Graceful fallback when JAAR API is unreachable

## 7. Artifacts Structure & CI (Chunk 4)

- [ ] 7.1 Create `artifacts/agents/jarvis-assistant/manifest.yaml`
- [ ] 7.2 Create `artifacts/skills/task-management/manifest.yaml`
- [ ] 7.3 Create `artifacts/prompts/daily-planning/manifest.yaml`
- [ ] 7.4 Create `.github/workflows/artifacts-publish.yml` — On push to main, build changed artifacts, push to GHCR, call AgentRegistry API to register

## 8. Validation & Cleanup

- [ ] 8.1 Run `helm template helm/jaar/` and verify all manifests render without errors
- [ ] 8.2 Run backend tests to confirm no regressions
- [ ] 8.3 Run frontend build to confirm base path changes produce valid bundle
- [ ] 8.4 Test full local deployment: `make cluster-up && make deploy-local` with both JARVIS and JAAR services running
- [ ] 8.5 Verify routing: `/jarvis/api/v1/tasks` → backend, `/jarvis` → frontend, `/jaar/v0/servers` → AgentRegistry, `/` → redirect to `/jarvis`
