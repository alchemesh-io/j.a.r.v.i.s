## 1. JAAR Helm Chart

- [x] 1.1 Create `helm/jaar/Chart.yaml` — wrapper chart with upstream `agentregistry:0.3.3` OCI subchart dependency (`oci://ghcr.io/agentregistry-dev/agentregistry/charts`)
- [x] 1.2 Create `helm/jaar/values.yaml` — upstream subchart config (image, anonymous auth, bundled PostgreSQL), optional external DB via K8s Secret, gateway host
- [x] 1.3 Create `helm/jaar/templates/namespace.yaml` — `jaar` namespace with `istio-injection: enabled` label
- [x] 1.4 Create `helm/jaar/templates/httproute.yaml` — host-based routing for `jaar.jarvis.io` → `jaar-agentregistry:12121`

## 2. JAAR ArgoCD & Secrets

- [x] 2.1 Create `argocd/jaar-app.yaml` — ArgoCD Application CR targeting `helm/jaar/` with automated sync
- [x] 2.2 Create `argocd/jaar-app-local.yaml` — Local variant for `deploy-local`
- [x] 2.3 Create `secrets/jaar-secret.example.yaml` — template with JWT key and optional external DB URL
- [x] 2.4 Add `secrets/jaar-secret.yaml` to `.gitignore`

## 3. Istio Gateway — Host-Based Routing

- [x] 3.1 Update `helm/istio/templates/gateway.yaml` — HTTP listener (port 80, no hostname filter for localhost support) + HTTPS listener (port 443, `*.jarvis.io` with self-signed TLS cert)
- [x] 3.2 Update `helm/jarvis/templates/httproute.yaml` — host-based routing for `main.jarvis.io` + `localhost`, simple paths (`/api/*`, `/docs`, `/health`, `/*` catch-all), no prefix stripping
- [x] 3.3 Create `helm/istio/templates/argocd-httproute.yaml` — HTTPS route for `jaac.jarvis.io` → `argocd-server:80`, plus HTTP→HTTPS redirect
- [x] 3.4 Create `helm/jarvis/templates/mcp-httproute.yaml` — host-based routing for `mcp.jarvis.io` → MCP server
- [x] 3.5 Add `gateway.host` and `gateway.mcpHost` to `helm/jarvis/values.yaml`

## 4. Frontend — JAAR Dashboard Card

- [x] 4.1 Create `frontend/src/api/jaar.ts` — API client fetching unique artifact counts from `jaar.jarvis.io/v0/*` (servers, agents, skills, prompts) with graceful fallback
- [x] 4.2 Add Agent Registry card to Dashboard — `agent-registry` block in orbital HUD layout with TanStack Query hooks, drag-and-drop, compact mode
- [x] 4.3 Add `dashboard__hud-registry` CSS — orbital position (bottom), hover/drag animations, responsive breakpoint
- [x] 4.4 "Open Registry" link opens `jaar.jarvis.io` in new tab

## 5. MCP Server — Relocation & Rewrite

- [x] 5.1 Scaffold new MCP server at `artifacts/servers/jarvis/` using `arctl mcp init python` (FastMCP with dynamic tool loading)
- [x] 5.2 Migrate `BackendClient` to `src/core/api_client.py` — aligned to current backend models (`source_type`/`source_id` instead of `jira_ticket_id`)
- [x] 5.3 Create tool modules: `src/tools/tasks.py` (create, get, list, update, delete), `src/tools/dailies.py` (create, get, get_by_date, add/remove/reorder tasks), `src/tools/weeklies.py` (create, list, get)
- [x] 5.4 Migrate and expand tests — 33 tests (16 API client + 4 discovery + 9 server + 4 tool loading)
- [x] 5.5 Update `helm/jarvis/templates/mcp-deployment.yaml` — add `args` for HTTP transport mode (`--transport http --host 0.0.0.0 --port 8080`)
- [x] 5.6 Remove old `mcp_server/` directory
- [x] 5.7 Create `.mcp.json` — Claude Code MCP config pointing to `http://mcp.jarvis.io/mcp`

## 6. Artifacts Structure & CI

- [x] 6.1 Create `artifacts/` directory with `servers/`, `agents/`, `skills/`, `prompts/` (`.gitkeep` for empty dirs)
- [x] 6.2 Create `.github/workflows/artifacts-publish.yml` — matrix-based CI using `arctl mcp build --push` per server
- [x] 6.3 Add `make sync-artifacts` / `sync-artifacts-servers` — publish all GHCR tags + local images to JAAR via `arctl mcp publish`
- [x] 6.4 Add arctl install instructions and artifact conventions to CLAUDE.md

## 7. Makefile & Infrastructure

- [x] 7.1 Update `deploy` / `deploy-local` / `undeploy` — include JAAR Application CRs, JAAR secrets, helm dep update
- [x] 7.2 Update `sync` — trigger both `jarvis` and `jaar` ArgoCD syncs
- [x] 7.3 Add `_tls-secret` target — generate self-signed wildcard cert for `*.jarvis.io`
- [x] 7.4 Add `_deploy-jaar-secrets` / `_helm-dep-update` internal targets
- [x] 7.5 Configure ArgoCD insecure mode (`server.insecure=true`) in `_argocd-install` for gateway TLS termination
- [x] 7.6 Label `jaar` namespace for Istio sidecar injection in `_istio-install`
- [x] 7.7 Add `.dockerignore` for `artifacts/servers/jarvis/`
- [x] 7.8 Update `test-mcp` target to `artifacts/servers/jarvis`
- [x] 7.9 Update `argocd-ui` / `jarvis-ui` targets for host-based routing docs

## 8. Documentation (CLAUDE.md)

- [x] 8.1 Update repository structure — add `artifacts/`, `helm/jaar/`, ArgoCD CRs, secrets, MCP server new location
- [x] 8.2 Update routing docs — host-based routing (`main.jarvis.io`, `mcp.jarvis.io`, `jaar.jarvis.io`, `jaac.jarvis.io`)
- [x] 8.3 Add Artifacts & Agent Registry section — arctl usage, artifact conventions
- [x] 8.4 Add MCP Server section — new location, dynamic tool loading, HTTP transport
- [x] 8.5 Update known limitations — JAAR RAM overhead, `/etc/hosts` requirement
- [x] 8.6 Update prerequisites — add `helm`, `arctl`
- [x] 8.7 Update forbidden files — add `secrets/jaar-secret.yaml`

## 9. Validation

- [x] 9.1 `helm template helm/jaar/` renders without errors
- [x] 9.2 Backend tests — 54 passed
- [x] 9.3 Frontend build succeeds
- [x] 9.4 MCP server tests — 33 passed
- [x] 9.5 Full local deployment verified — all services running, routing confirmed
- [x] 9.6 Routing verified: `main.jarvis.io` → JARVIS, `jaar.jarvis.io` → AgentRegistry, `jaac.jarvis.io` → ArgoCD (HTTPS), `mcp.jarvis.io` → MCP server
