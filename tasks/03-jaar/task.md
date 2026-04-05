## Short description

J.A.A.R (Just An Agent Registry) is a new feature that aims to deploy alongside JARVIS an agent registry using [https://github.com/agentregistry-dev/agentregistry](https://github.com/agentregistry-dev/agentregistry).

## Context

As an assistant, J.A.R.V.I.S's first job is to help work organization through task management (backlog, daily plannings, weekly aggregates). The agent registry provides a way to manage all the artifacts related to J.A.R.V.I.S (MCP servers, agents, prompts, skills), that in the future will be pulled by J.A.W (Just A Worker) when deployed.

### About AgentRegistry

AgentRegistry is an open-source (Apache 2.0) registry platform written in **Go** (server/CLI) with a **Next.js/TypeScript** web UI. It provides a single, curated catalog for AI building blocks with governance controls.

#### Ports & Interfaces

| Port   | Protocol | Purpose                     |
|--------|----------|-----------------------------|
| 12121  | HTTP     | Web UI + REST API (`/v0/`)  |
| 21212  | gRPC     | gRPC API                    |
| 31313  | MCP      | MCP protocol endpoint       |

#### Artifact Types (first-class)

| Artifact    | API Path        | Description                                       |
|-------------|-----------------|---------------------------------------------------|
| **Servers** | `/v0/servers`   | MCP servers sourced from npm, PyPI, or OCI/Docker |
| **Agents**  | `/v0/agents`    | AI agents with bundled dependencies               |
| **Skills**  | `/v0/skills`    | Knowledge/code example bundles with documentation |
| **Prompts** | `/v0/prompts`   | Reusable prompt templates                         |

#### Storage

- PostgreSQL with pgvector extension (bundled in Helm chart for dev, 5Gi PVC default)
- Supports external PostgreSQL via `AGENT_REGISTRY_DATABASE_URL`

#### Deployment

- Helm chart available at `charts/agentregistry/` in the upstream repo
- Docker image: `ghcr.io/agentregistry-dev/agentregistry:server` (tag `0.2.1`)
- CLI tool `arctl` for client/local daemon management

#### Auth

- Supports GitHub OAuth, OIDC, and anonymous mode
- **For this task: anonymous mode only** (`ENABLE_ANONYMOUS_AUTH=true`), no OIDC/OAuth wiring

## Architecture

### Current State

```
                    Istio Gateway (:80)
                         │
            ┌────────────┼────────────┐
            │            │            │
         /api/*        /docs       /* (catch-all)
            │            │            │
     ┌──────▼──────┐     │    ┌──────▼──────┐
     │   Backend   │◀────┘    │  Frontend   │
     │  (FastAPI)  │          │  (React)    │
     │   :8000     │          │   :80       │
     └──────┬──────┘          └─────────────┘
            │
     ┌──────▼──────┐
     │  MCP Server │
     │   :8080     │
     └─────────────┘

Everything in `jarvis` namespace, single ArgoCD Application.
```

### Target State

```
         Gateway (istio-system)
              parentRefs
           ┌──────┴──────┐
           │              │
    HTTPRoute          HTTPRoute
   (jarvis ns)        (jaar ns)
    /jarvis/*          /jaar/*

┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  istio-system       │     │  jarvis              │     │  jaar               │
│                     │     │                      │     │                      │
│  Gateway            │     │  backend :8000       │     │  agentregistry      │
│  (jarvis-gateway)   │     │  frontend :80        │     │    :12121 (HTTP)    │
│                     │     │  mcp :8080           │     │    :21212 (gRPC)    │
│                     │     │                      │     │    :31313 (MCP)     │
│                     │     │                      │     │                      │
│                     │     │                      │     │  postgresql          │
│                     │     │                      │     │    :5432             │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

### Routing Strategy: Prefix Strip (URL Rewrite)

The gateway strips the `/jarvis` and `/jaar` prefixes before forwarding to backend services. This means **backend and MCP server require zero changes** — they continue to see `/api/v1/*` paths.

```
Browser sends:    /jarvis/api/v1/tasks
Gateway rewrites: /api/v1/tasks         → jarvis-backend:8000
Backend sees:     /api/v1/tasks

Browser sends:    /jaar/v0/servers
Gateway rewrites: /v0/servers           → jaar-agentregistry:12121
Registry sees:    /v0/servers
```

Root `/` redirects to `/jarvis`.

### HTTPRoute Per Namespace (no cross-namespace refs)

Each namespace owns its own HTTPRoute, both attached to the same Gateway via `parentRefs`. This avoids `ReferenceGrant` objects and keeps Helm charts self-contained.

## Implementation details

### Chunk 1 — Agent Registry Deployment

Deploy AgentRegistry via ArgoCD in a **dedicated `jaar` namespace**.

**New files:**
- `argocd/jaar-app.yaml` — ArgoCD Application CR pointing to `helm/jaar`
- `argocd/jaar-app-local.yaml` — local image variant
- `helm/jaar/` — vendored/adapted Helm chart from upstream

**Helm chart (`helm/jaar/`) must include:**
- `Chart.yaml`, `values.yaml`
- `templates/deployment.yaml` — AgentRegistry pod (image: `ghcr.io/agentregistry-dev/agentregistry:server`)
- `templates/service.yaml` — ClusterIP service exposing port 12121
- `templates/postgresql.yaml` — bundled PostgreSQL + pgvector with PVC
- `templates/namespace.yaml` — `jaar` namespace with `istio-injection: enabled` label
- `templates/httproute.yaml` — routes for `/jaar/*` (see Chunk 2)

**Config env vars:**
```
AGENT_REGISTRY_SERVER_ADDRESS=:8080
AGENT_REGISTRY_DATABASE_URL=postgres://...
AGENT_REGISTRY_ENABLE_ANONYMOUS_AUTH=true
AGENT_REGISTRY_ENABLE_REGISTRY_VALIDATION=false
```

**Makefile updates:**
- Add JAAR image build/load targets for `deploy-local`
- Consider bumping default `MINIKUBE_MEMORY` (PostgreSQL + AgentRegistry adds overhead on top of Istio + ArgoCD)

### Chunk 2 — Istio Gateway Integration

Move JARVIS under `/jarvis` prefix and expose JAAR under `/jaar`.

**Changes to existing files:**

| File | Change |
|------|--------|
| `helm/jarvis/templates/httproute.yaml` | Rewrite all rules to use `/jarvis` prefix with `URLRewrite` filter (strip prefix) |
| `frontend/vite.config.ts` | Add `base: '/jarvis/'` |
| `frontend/src/App.tsx` | Add `basename="/jarvis"` to `<BrowserRouter>` |
| `frontend/src/api/client.ts` | Change `API_BASE` to `'/jarvis/api/v1'` |
| `frontend/vite.config.ts` (proxy) | Update dev proxy paths to `/jarvis/api` etc. |

**New files:**
- `helm/jaar/templates/httproute.yaml` — `/jaar/*` routes with URL rewrite to strip prefix

**HTTPRoute rules summary:**

JARVIS (in `jarvis` namespace):
```yaml
rules:
  - matches: [{path: {type: PathPrefix, value: /jarvis/api/}}]
    filters: [{type: URLRewrite, urlRewrite: {path: {type: ReplacePrefixMatch, replacePrefixMatch: /api/}}}]
    backendRefs: [{name: jarvis-backend, port: 8000}]
  - matches: [{path: {type: PathPrefix, value: /jarvis}}]
    filters: [{type: URLRewrite, urlRewrite: {path: {type: ReplacePrefixMatch, replacePrefixMatch: /}}}]
    backendRefs: [{name: jarvis-frontend, port: 80}]
  - matches: [{path: {type: Exact, value: /}}]  # Root redirect
    filters: [{type: RequestRedirect, requestRedirect: {path: {type: ReplaceFullPath, replaceFullPath: /jarvis}}}]
```

JAAR (in `jaar` namespace):
```yaml
rules:
  - matches: [{path: {type: PathPrefix, value: /jaar}}]
    filters: [{type: URLRewrite, urlRewrite: {path: {type: ReplacePrefixMatch, replacePrefixMatch: /}}}]
    backendRefs: [{name: jaar-agentregistry, port: 12121}]
```

**What does NOT change:**
- Backend (`app/main.py`) — routes stay at `/api/v1`, gateway handles prefix
- MCP server — talks to backend via K8s service DNS, not through gateway
- Backend ConfigMap / Secrets

### Chunk 3 — JARVIS UI Integration with JAAR

Add a card on the Dashboard to visualize artifact counts from JAAR, grouped by kind.

**Frontend calls JAAR API directly through the gateway** (no backend proxy):
```ts
const JAAR_API = '/jaar/v0';

// Fetch counts
GET /jaar/v0/servers  → count MCP servers
GET /jaar/v0/agents   → count agents
GET /jaar/v0/skills   → count skills
GET /jaar/v0/prompts  → count prompts
```

**Dashboard card design:**
```
┌─────────────────────────────┐
│  Agent Registry              │
│                              │
│  MCP Servers         3      │
│  Agents              2      │
│  Skills              7      │
│  Prompts             4      │
│                              │
│  [Open Registry →]           │
└─────────────────────────────┘
```

- "Open Registry" links to `/jaar` (AgentRegistry's Next.js UI)
- Card lives on the existing Dashboard page
- New API client functions in a `frontend/src/api/jaar.ts` file
- Use TanStack Query for fetching/caching

### Chunk 4 — Artifacts Automation (Repo Structure + GHCR)

Structure the JARVIS repository to declare artifacts that get published to AgentRegistry via GHCR.

**New directory structure:**
```
artifacts/
├── servers/
│   └── jarvis-mcp/
│       └── manifest.yaml
├── agents/
│   └── jarvis-assistant/
│       └── manifest.yaml
├── skills/
│   └── task-management/
│       └── manifest.yaml
└── prompts/
    └── daily-planning/
        └── manifest.yaml
```

**CI pipeline** (`.github/workflows/`):
- On push to `main`: build artifacts → push to GHCR → call AgentRegistry API to register

**Uses GitHub Package Registry (GHCR) with Docker** for artifact storage as destination.

## Dependency Order

```
Chunk 1 (deploy JAAR)
    │
    ▼
Chunk 2 (routing /jarvis + /jaar)
    │
    ├──► Chunk 3 (dashboard card — needs /jaar routes working)
    │
    └──► Chunk 4 (artifacts — independent, needs JAAR API available)
```

Chunk 1 is prerequisite to everything. Chunk 2 is prerequisite to Chunk 3. Chunk 4 is mostly independent once JAAR is deployed.
