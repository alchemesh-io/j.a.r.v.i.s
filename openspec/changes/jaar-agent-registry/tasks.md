## 1. JAAR Helm Chart (Chunk 1)

- [x] 1.1 Create `helm/jaar/Chart.yaml` with chart metadata and pinned upstream AgentRegistry v0.3.3 as subchart dependency
- [x] 1.2 Create `helm/jaar/values.yaml` with upstream subchart config, optional external DB via K8s Secret, and gateway reference
- [x] 1.3 Create `helm/jaar/templates/namespace.yaml` — `jaar` namespace with `istio-injection: enabled` label
- [x] 1.4 PostgreSQL provided by upstream AgentRegistry subchart (bundled Bitnami PostgreSQL with pgvector)
- [x] 1.5 AgentRegistry deployment provided by upstream subchart (v0.3.3)
- [x] 1.6 AgentRegistry service provided by upstream subchart

## 2. JAAR ArgoCD Applications (Chunk 1)

- [x] 2.1 Create `argocd/jaar-app.yaml` — ArgoCD Application CR targeting `helm/jaar/` with automated sync
- [x] 2.2 Create `argocd/jaar-app-local.yaml` — Local variant
- [x] 2.3 Update `Makefile` — Add JAAR deploy/undeploy/sync, secret deployment, helm dep update

## 3. Istio Gateway Routing Restructure (Chunk 2)

- [x] 3.1 Update `helm/jarvis/templates/httproute.yaml` — Change rules to `/jarvis/api/*` with URLRewrite stripping `/jarvis` prefix, `/jarvis/*` catch-all to frontend with prefix strip, and `/` exact redirect to `/jarvis`
- [x] 3.2 Create `helm/jaar/templates/httproute.yaml` — `/jaar/*` prefix match with URLRewrite to strip prefix, forwarding to `jaar-agentregistry:12121`
- [x] 3.3 Update `Makefile` `cluster-up` target — Label `jaar` namespace for Istio sidecar injection alongside `jarvis`

## 4. Frontend Base Path Changes (Chunk 2)

- [x] 4.1 Update `frontend/vite.config.ts` — Set `base: '/jarvis/'`
- [x] 4.2 Update `frontend/src/App.tsx` — Add `basename="/jarvis"` to `<BrowserRouter>`
- [x] 4.3 Update `frontend/src/api/client.ts` — Change `API_BASE` to `'/jarvis/api/v1'`
- [x] 4.4 Update `frontend/vite.config.ts` dev proxy — Adjust proxy paths for `/jarvis/api` prefix

## 5. MCP Server Relocation (Chunk 2)

- [x] 5.1 Create `artifacts/servers/` directory and copy `mcp_server/` contents to `artifacts/servers/jarvis-mcp/`
- [x] 5.2 Create `artifacts/servers/jarvis-mcp/manifest.yaml` with artifact metadata
- [x] 5.3 N/A — Helm values don't reference build context path
- [x] 5.4 N/A — `mcp-deployment.yaml` uses image repo/tag, no Dockerfile path
- [x] 5.5 N/A — MCP server not yet in `docker-publish.yml`
- [x] 5.6 Update `Makefile` — Change MCP image build path for `deploy-local`
- [x] 5.7 Run MCP server tests from new location — all 10 passed

## 6. Dashboard Agent Registry Card (Chunk 3)

- [x] 6.1 Create `frontend/src/api/jaar.ts` — Typed API client with functions for fetching servers, agents, skills, prompts from `/jaar/v0/*`
- [x] 6.2 Create Agent Registry card component — Reuses MetricBlock with "Open Registry" link to `/jaar`
- [x] 6.3 Integrate card into Dashboard page — Added to grid layout with drag-and-drop and compact mode support
- [x] 6.4 Add TanStack Query hooks for JAAR API calls with caching
- [x] 6.5 Handle error/loading states — fetchCount returns 0 on failure, dashboard unaffected

## 7. Artifacts Structure & CI (Chunk 4)

- [x] 7.1 Create `artifacts/` directory structure with `servers/`, `agents/`, `skills/`, `prompts/` (.gitkeep)
- [x] 7.2 Add arctl install instructions and artifact conventions to CLAUDE.md
- [x] 7.3 Create `.github/workflows/artifacts-publish.yml` — On push to main (artifacts/**), build images, push to GHCR, register with arctl --docker-url

## 8. Validation & Cleanup

- [x] 8.1 Run `helm template helm/jaar/` — renders without errors (upstream subchart + namespace + httproute)
- [x] 8.2 Run backend tests — 54 passed
- [x] 8.3 Run frontend build — production bundle emitted with /jarvis/ base path
- [ ] 8.4 Test full local deployment: `make cluster-up && make deploy-local` with both JARVIS and JAAR services running
- [ ] 8.5 Verify routing: `/jarvis/api/v1/tasks` → backend, `/jarvis` → frontend, `/jaar/v0/servers` → AgentRegistry, `/` → redirect to `/jarvis`
