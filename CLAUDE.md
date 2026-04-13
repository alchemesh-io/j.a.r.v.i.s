# J.A.R.V.I.S — Claude Code Guide

## Forbidden Files

**NEVER read, write, display, or reference the contents of `secrets/backend-secret.yaml` or `secrets/jaar-secret.yaml`.** These files contain sensitive credentials and are not version-controlled. Use the corresponding `.example.yaml` files as a reference for the expected structure.

## Project Overview

J.A.R.V.I.S (Just A Rather Very Intelligent System) is a multi-agent personal assistant platform targeting a production Kubernetes deployment. This repository contains a Python/FastAPI backend with task management API, a React/Vite frontend with dashboard and task board UIs, a J.A.D.S design system, an MCP server for agent integration, a Helm chart, and a Makefile-driven local dev cluster.

## Repository Structure

```
j.a.r.v.i.s/
├── Makefile                  # Local cluster and deploy lifecycle
├── CLAUDE.md                 # This file
├── argocd/
│   ├── istio-app.yaml          # ArgoCD Application CR for Istio service mesh
│   ├── jarvis-app.yaml         # ArgoCD Application CR (GHCR images)
│   ├── jarvis-app-local.yaml   # ArgoCD Application CR (local images)
│   ├── jaar-app.yaml           # ArgoCD Application CR for JAAR (GHCR images)
│   ├── jaar-app-local.yaml     # ArgoCD Application CR for JAAR (local)
│   └── repo-server-patch.yaml  # hostPath volume patch for argocd-repo-server
├── secrets/
│   ├── backend-secret.example.yaml  # Template — copy to backend-secret.yaml
│   ├── backend-secret.yaml          # (gitignored) Actual K8s Secret manifest
│   ├── jaar-secret.example.yaml     # Template — copy to jaar-secret.yaml
│   └── jaar-secret.yaml             # (gitignored) JAAR PostgreSQL/DB credentials
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI application — routes mounted under /api/v1
│   │   ├── config.py         # Pydantic BaseSettings for env-based configuration
│   │   ├── db/
│   │   │   ├── engine.py     # SQLAlchemy 2 engine factory with WAL mode
│   │   │   ├── session.py    # SessionLocal + get_db() FastAPI dependency
│   │   │   └── base.py       # Declarative Base class
│   │   ├── models/
│   │   │   ├── enums.py      # TaskType, TaskStatus, WorkerState, WorkerType (str, Enum)
│   │   │   ├── weekly.py     # Weekly ORM model
│   │   │   ├── daily.py      # Daily ORM model
│   │   │   ├── task.py       # Task ORM model (+ worker one-to-one)
│   │   │   ├── daily_task.py # DailyTask association model
│   │   │   ├── worker.py     # Worker ORM model (linked to Task, many-to-many Repository)
│   │   │   ├── repository.py # Repository ORM model (git_url + branch, unique)
│   │   │   └── worker_repository.py # WorkerRepository association table
│   │   ├── schemas/
│   │   │   ├── task.py       # Task Pydantic schemas (Create, Update, Response + WorkerSummary)
│   │   │   ├── daily.py      # Daily Pydantic schemas
│   │   │   ├── weekly.py     # Weekly Pydantic schemas
│   │   │   ├── daily_task.py # DailyTask schemas + reorder batch
│   │   │   ├── worker.py     # Worker Pydantic schemas (Create, Update, Response, Summary)
│   │   │   └── repository.py # Repository Pydantic schemas (Create, Response)
│   │   ├── services/
│   │   │   └── k8s.py        # Kubernetes client — create/delete worker pods, services, httproutes
│   │   └── routes/
│   │       ├── tasks.py      # /api/v1/tasks — CRUD + date/scope filtering
│   │       ├── weeklies.py   # /api/v1/weeklies — CRUD with nested dailies
│   │       ├── dailies.py    # /api/v1/dailies — CRUD + date query
│   │       ├── daily_tasks.py # /api/v1/dailies/{id}/tasks — add/remove/reorder
│   │       ├── workers.py    # /api/v1/workers — CRUD + K8s pod lifecycle
│   │       └── repositories.py # /api/v1/repositories — CRUD with conflict detection
│   ├── alembic/              # Alembic migrations
│   │   ├── env.py
│   │   └── versions/
│   ├── tests/                # pytest test suite
│   ├── Dockerfile            # Multi-stage image; non-root user on port 8000
│   └── pyproject.toml        # Python 3.12+ deps
├── frontend/
│   ├── packages/
│   │   └── jads/             # J.A.D.S (Just A Design System) — @jarvis/jads
│   │       ├── src/
│   │       │   ├── components/ # Button, Card, Input, Select, IconButton, TaskCard, Calendar
│   │       │   ├── theme.css   # CSS custom properties (dark futuristic theme)
│   │       │   └── index.ts    # Barrel exports
│   │       ├── .storybook/     # Storybook 10.x config
│   │       └── package.json
│   ├── src/
│   │   ├── App.tsx           # Root with React Router, TanStack Query provider
│   │   ├── api/client.ts     # Typed fetch functions for /api/v1/ endpoints
│   │   ├── pages/
│   │   │   ├── Dashboard/    # Dashboard with metric blocks, brain animation, chat
│   │   │   ├── TaskBoard/    # Task board with calendar, DnD, CRUD
│   │   │   └── Workers/      # Worker management page (repository panel + worker cards)
│   │   ├── App.css           # App shell styles
│   │   └── index.css         # Global styles, CSS variables
│   ├── e2e/                  # Playwright E2E tests
│   │   └── playwright.config.ts
│   ├── index.html            # Document title: "J.A.R.V.I.S"
│   ├── Dockerfile            # Multi-stage: npm workspaces build → serve (static)
│   └── package.json          # Workspace root
├── artifacts/                  # Agent Registry managed artifacts
│   ├── servers/
│   │   └── jarvis/             # MCP server (FastMCP, dynamic tool loading)
│   │       ├── src/
│   │       │   ├── core/       # server.py, api_client.py, utils.py
│   │       │   ├── tools/      # tasks.py, dailies.py, weeklies.py
│   │       │   └── main.py
│   │       ├── tests/
│   │       ├── mcp.yaml        # Artifact metadata for Agent Registry
│   │       ├── Dockerfile
│   │       └── pyproject.toml
│   ├── agents/                 # Agent artifacts (add via arctl)
│   ├── skills/                 # Skill artifacts (add via arctl)
│   └── prompts/                # Prompt artifacts (add via arctl)
├── worker/
│   ├── Dockerfile            # Worker Docker image (node:22-slim + Claude Code + tools)
│   ├── entrypoint.sh         # Init sequence: config copy, repo clone, skill pull, start
│   └── status-server/
│       └── index.js          # Minimal HTTP status endpoint (port 8080)
├── helm/
│   ├── istio/                # Istio service mesh (deployed via ArgoCD)
│   │   ├── Chart.yaml        # Sub-chart deps: base, istiod, gateway
│   │   ├── values.yaml
│   │   └── templates/
│   │       ├── gateway.yaml          # HTTP (:80) + HTTPS (:443, *.jarvis.io) listeners
│   │       └── argocd-httproute.yaml # jaac.jarvis.io → ArgoCD (HTTPS + HTTP redirect)
│   ├── jaar/                 # JAAR — AgentRegistry wrapper chart
│   │   ├── Chart.yaml        # Depends on upstream agentregistry chart (OCI)
│   │   ├── values.yaml       # Subchart config, external DB, gateway ref
│   │   └── templates/
│   │       ├── namespace.yaml    # jaar namespace with istio-injection
│   │       └── httproute.yaml    # jaar.jarvis.io → AgentRegistry
│   └── jarvis/
│       ├── Chart.yaml
│       ├── values.yaml       # Backend, frontend, MCP image configs + settings
│       └── templates/
│           ├── backend-deployment.yaml
│           ├── backend-service.yaml
│           ├── backend-configmap.yaml  # DATABASE_URL, APP_TITLE, DEBUG
│           ├── backend-secret.yaml     # Sensitive config placeholder
│           ├── frontend-deployment.yaml
│           ├── frontend-service.yaml
│           ├── httproute.yaml          # main.jarvis.io + localhost → backend/frontend
│           ├── mcp-httproute.yaml      # mcp.jarvis.io → MCP server
│           ├── mcp-deployment.yaml     # Standalone MCP pod with BACKEND_URL
│           ├── mcp-service.yaml
│           ├── sqlite-pvc.yaml
│           ├── worker-serviceaccount.yaml   # ServiceAccount for backend K8s access
│           ├── worker-role.yaml             # Role for pod/service/httproute management
│           ├── worker-rolebinding.yaml      # RoleBinding for the ServiceAccount
│           └── worker-claude-config.yaml    # ConfigMap for Claude config files
└── .github/
    └── workflows/
        └── docker-publish.yml  # Build + push to GHCR on push to main
```

## API Versioning & Routing

All traffic enters through the Istio ingress gateway via host-based routing on port 80:

- `main.jarvis.io` — JARVIS: `/api/*` → backend, `/*` → frontend SPA (HTTP)
- `mcp.jarvis.io` — MCP server: `/*` → FastMCP HTTP transport (HTTP)
- `jaw.jarvis.io` — Worker UIs: `/<worker_id>/*` → worker pod chat UI (HTTP, dynamic HTTPRoutes)
- `jaar.jarvis.io` — AgentRegistry: `/*` → Next.js UI + API (HTTP)
- `jaac.jarvis.io` — ArgoCD UI (HTTPS — self-signed wildcard cert)

The gateway has two listeners: HTTP (:80) and HTTPS (:443) both matching `*.jarvis.io`. A self-signed wildcard TLS cert is generated by `make cluster-up` and stored as `jarvis-io-tls` secret in `istio-system`.

For local dev, add entries to `/etc/hosts` (or use dnsmasq for wildcard):
```
<GATEWAY-IP>  main.jarvis.io mcp.jarvis.io jaw.jarvis.io jaar.jarvis.io jaac.jarvis.io
```

Backend task management endpoints are under `/api/v1/`. OpenAPI docs at `main.jarvis.io/docs`.

## Local Development Workflow

### Prerequisites

| Tool | Required | Notes |
|------|----------|-------|
| `minikube` | Yes | GPU passthrough support for future vLLM work |
| `kubectl` | Yes | Cluster interaction |
| `docker` | Yes | Image builds |
| `argocd` CLI | No | Optional; Makefile falls back to `kubectl` |
| `helm` | Yes | Dependency management for JAAR chart |
| `arctl` | No | AgentRegistry CLI for managing artifacts. Install: `curl -fsSL https://raw.githubusercontent.com/agentregistry-dev/agentregistry/main/scripts/get-arctl \| bash` |

### Starting the cluster

```bash
make cluster-up                          # Default: 4 CPUs, 8 GB RAM
make cluster-up MINIKUBE_CPUS=6 MINIKUBE_MEMORY=12288   # Override resources
```

This will:
1. Start a Minikube cluster
2. Launch `minikube mount` in the background (PID in `.minikube-mount.pid`)
3. Deploy Istio service mesh via ArgoCD Application CR (`argocd/istio-app.yaml`)
4. Label `jarvis` and `jaar` namespaces for Istio sidecar injection
5. Install ArgoCD v3.3.6 into the `argocd` namespace
6. Patch `argocd-repo-server` with a hostPath volume for `/mnt/jarvis-repo`
7. Register `file:///mnt/jarvis-repo` as an ArgoCD repository

### Deploying the application

```bash
make deploy          # Pull latest GHCR images, load into Minikube, sync
make deploy-local    # Build images locally, load into Minikube, sync
make argocd-ui       # Port-forward ArgoCD UI to https://localhost:8080
make sync            # Trigger a hard sync without rebuilding images
make undeploy        # Delete Application CR (cascade removes all resources)
```

### Accessing services

After `make deploy`, run `minikube tunnel` in a separate terminal, then:

```bash
kubectl get svc istio-ingressgateway -n istio-system   # Shows EXTERNAL-IP for the Istio ingress
```

All traffic enters through the Istio ingress gateway via host-based routing (`*.jarvis.io`):
- `main.jarvis.io`: `/api/*`, `/docs`, `/health` → backend; `/*` → frontend SPA
- `mcp.jarvis.io`: `/*` → MCP server (FastMCP HTTP transport)
- `jaw.jarvis.io`: `/<worker_id>/*` → worker pod chat UI (dynamic HTTPRoutes)
- `jaar.jarvis.io`: `/*` → AgentRegistry
- `jaac.jarvis.io`: `/*` → ArgoCD UI (HTTPS)

### Teardown

```bash
make cluster-down    # Kill minikube mount, delete cluster
```

### Running tests

```bash
# Backend
cd backend && uv run pytest tests/ -v

# Frontend (J.A.D.S component tests)
cd frontend/packages/jads && npm test

# Frontend (E2E — requires running frontend + backend)
cd frontend && npx playwright test --config e2e/playwright.config.ts

# MCP server
cd artifacts/servers/jarvis && uv run pytest tests/ -v
```

## Coding Conventions

### Backend (Python)

- Python 3.12+; `uv` as package manager (`uv sync`, `uv run`); type hints encouraged
- FastAPI with synchronous SQLAlchemy 2 (`check_same_thread=False` for SQLite)
- Pydantic 2.12.5 as the universal data modeling layer — all request/response bodies and config use Pydantic BaseModel classes, no raw dicts
- Database path always via `DATABASE_URL` env var — do not hardcode paths
- Alembic for migrations — auto-generate from model changes, never modify tables by hand
- Session management via `Depends(get_db)` — yield-based with auto-commit/rollback
- Non-root Docker user (UID 1000); app runs on port 8000
- All new endpoints must have a corresponding entry in the OpenAPI docs (auto-generated by FastAPI)

### Frontend (TypeScript/React)

- Vite v7.x, React 19, TypeScript 5.9
- npm workspaces: `packages/jads/` is the `@jarvis/jads` design system
- J.A.D.S components documented with Storybook 10.x, tested with Vitest + React Testing Library
- Playwright for E2E tests (config at `e2e/playwright.config.ts`)
- React Router v7 for client-side routing
- TanStack Query for server state management
- @dnd-kit for drag-and-drop (task board + dashboard)
- CSS variables defined in `src/index.css` and `packages/jads/src/theme.css` — extend there, not inline
- All interactive elements must be keyboard-accessible with visible `:focus-visible` indicators
- Page landmarks: `<header>`, `<main>`, `<footer>` must remain in `App.tsx`
- Document title must remain `"J.A.R.V.I.S"`

### MCP Server

- Located at `artifacts/servers/jarvis/` (FastMCP with dynamic tool loading)
- Scaffolded via `arctl mcp init python`; tools auto-discovered from `src/tools/` directory
- Communicates with backend exclusively via REST API (`/api/v1/`) — no direct database access
- Backend URL configured via `BACKEND_URL` env var
- Uses `httpx` for async HTTP client with timeout and retry
- Runs in HTTP transport mode in K8s (`--transport http --host 0.0.0.0 --port 8080`)
- Exposed via gateway at `mcp.jarvis.io`; Claude Code config in `.mcp.json`

### Artifacts & Agent Registry (JAAR)

- JAAR (Just An Agent Registry) runs AgentRegistry v0.3.3 in the `jaar` namespace
- Helm chart at `helm/jaar/` wraps the upstream `oci://ghcr.io/agentregistry-dev/agentregistry` chart as a dependency
- Bundled PostgreSQL (Bitnami subchart) enabled by default; set `agentregistry.database.enabled=false` for external DB (CloudSQL, RDS)
- Credentials stored in `secrets/jaar-secret.yaml` (gitignored); see `secrets/jaar-secret.example.yaml`
- Anonymous auth enabled — no OAuth/OIDC for local dev
- The `artifacts/` directory holds registry-managed artifacts, one folder per type: `servers/`, `agents/`, `skills/`, `prompts/`
- Each artifact lives in its own subfolder with a `manifest.yaml` and source files
- Use `arctl` to interact with the registry:
  ```bash
  # Install arctl
  curl -fsSL https://raw.githubusercontent.com/agentregistry-dev/agentregistry/main/scripts/get-arctl | bash

  # Common commands (run against local JAAR instance)
  arctl server list
  arctl server register ./artifacts/servers/jarvis/mcp.yaml
  arctl agent list
  arctl skill list
  arctl prompt list
  ```
- When adding a new artifact: create a subfolder under the appropriate `artifacts/<type>/` directory with a `manifest.yaml`, then register it with `arctl`

### Infrastructure

- ArgoCD renders Helm charts internally — never run `helm install/upgrade` directly
- ArgoCD syncs from `HEAD` of the current branch via `minikube mount`
- Helm values for image tags use `latest` by default locally; CI tags with short git SHA
- Kubernetes Gateway API (Gateway + HTTPRoute) with Istio: host-based routing on `*.jarvis.io` (`main.jarvis.io` → JARVIS, `mcp.jarvis.io` → MCP server, `jaar.jarvis.io` → AgentRegistry)
- Backend config via ConfigMap (`backend-configmap.yaml`), secrets via Secret (`backend-secret.yaml`)
- JAAR config via upstream AgentRegistry subchart, secrets via Secret (`jaar-secret.yaml`)
- Frontend uses `serve` for static files — no nginx (Istio handles routing via host-based matching)
- MCP server gets `BACKEND_URL` from its deployment env vars

## Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|-----------|
| **SQLite is single-writer** | No horizontal scaling for backend | Acceptable for local dev; migration to PostgreSQL planned (change `DATABASE_URL` + Helm chart) |
| **`minikube mount` must stay running** | ArgoCD loses access to chart if process dies | `make cluster-status` shows mount health; `make cluster-up` is idempotent and restarts it |
| **ArgoCD syncs from HEAD via minikube mount** | Uncommitted Helm changes are visible immediately via the filesystem mount | Use `make sync` to force ArgoCD to re-read |
| **ArgoCD + Istio add ~1 GB RAM overhead** | May strain developer laptops | Tune with `MINIKUBE_MEMORY` override |
| **MCP server depends on backend** | MCP tools fail if backend is down | httpx with retry logic; K8s readiness probes check backend connectivity |
| **JAAR + PostgreSQL add ~512 MB RAM** | May require more Minikube memory | Bump with `MINIKUBE_MEMORY=12288` |
| **Data persistence requires mount** | `minikube mount` for `.data/` must stay running | `make cluster-status` shows mount health; data survives `minikube delete` |
| **Host-based routing requires `/etc/hosts`** | `*.jarvis.io` must resolve to gateway IP | Add entries for `main.jarvis.io`, `mcp.jarvis.io`, `jaw.jarvis.io`, `jaar.jarvis.io`, `jaac.jarvis.io` (or use dnsmasq for wildcard) |
| **Worker pods consume significant resources** | Each worker pod runs Claude Code + UI + status server (~512MB–1GB RAM) | Set resource requests/limits via Helm values; limit concurrent workers |
| **Dynamic HTTPRoutes managed outside ArgoCD** | Worker HTTPRoutes aren't managed by ArgoCD sync | Worker deletion explicitly removes HTTPRoutes; orphan cleanup can be added later |
