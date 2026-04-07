## Context

JARVIS runs on Kubernetes with Istio and ArgoCD. The current stack has three services in the `jarvis` namespace: a FastAPI backend (`:8000`), a React/Vite frontend (`:80`), and an MCP server (`:8080`). Ingress uses an Istio Gateway with a single catch-all HTTPRoute: `/api/*` routes to backend, `/*` routes to frontend.

This design covers integrating AgentRegistry (JAAR) — an open-source Go/Next.js registry for AI artifacts — as a second service alongside JARVIS, plus restructuring the repository to organize artifacts (MCP servers, agents, skills, prompts) under a unified directory with the MCP server relocated as the first managed artifact.

## Goals / Non-Goals

**Goals:**

- Deploy AgentRegistry in an isolated `jaar` namespace with independent lifecycle and storage
- Restructure ingress from catch-all to prefix-based routing (`/jarvis/*`, `/jaar/*`) under a single domain, with zero application code changes in backend or AgentRegistry
- Relocate the MCP server from `mcp_server/` to `artifacts/servers/jarvis-mcp/`, establishing the artifact directory convention
- Enable the JARVIS frontend to call AgentRegistry APIs directly through the shared gateway

**Non-Goals:**

- Production-grade PostgreSQL (HA, backups, managed DB) — future work
- OAuth/OIDC for AgentRegistry — internal-only, anonymous auth sufficient
- Upstream chart version tracking automation — manual pin is acceptable

## Decisions

### 1. Dedicated `jaar` namespace over shared `jarvis` namespace

JAAR gets its own namespace. This isolates PostgreSQL storage, prevents Helm naming collisions, and allows independent ArgoCD sync cycles.

*Alternative*: Shared namespace would be simpler but couples deployment lifecycles and complicates resource ownership.

### 2. Host-based routing over prefix-based routing

Ingress uses host-based routing on `*.jarvis.io`: `main.jarvis.io` → JARVIS, `mcp.jarvis.io` → MCP server, `jaar.jarvis.io` → AgentRegistry, `jaac.jarvis.io` → ArgoCD (HTTPS). No URL rewrite needed — each service sees clean paths. The gateway has HTTP (:80) and HTTPS (:443, TLS-terminated with self-signed wildcard cert) listeners.

*Originally planned*: Prefix-based routing (`/jarvis/*`, `/jaar/*`) was abandoned because AgentRegistry's embedded Next.js UI cannot run behind a path prefix (no `basePath` support), and multiple apps sharing `/_next/` paths would conflict.

*Trade-off*: Requires `/etc/hosts` entries (or dnsmasq) for `*.jarvis.io` resolution.

### 3. HTTPRoute per namespace, attached to shared Gateway

Each namespace owns its own HTTPRoute, referencing the shared Istio Gateway via `parentRefs`. Keeps Helm charts self-contained with no `ReferenceGrant` objects needed.

*Alternative*: Centralized HTTPRoute would require cross-namespace backend refs and couple the two Helm releases.

### 4. Frontend calls AgentRegistry directly via host-based routing

The JARVIS frontend calls `jaar.jarvis.io/v0/*` from the browser. Cross-origin requests work because both are on the same `*.jarvis.io` domain. No backend proxy needed.

*Alternative*: Backend proxy would add latency and coupling between independent services for no benefit.

### 5. Anonymous auth only

`ENABLE_ANONYMOUS_AUTH=true`, no OAuth/OIDC. Internal-only deployment. Auth can be layered later via Istio authorization policies or AgentRegistry's own mechanisms.

### 6. Bundled PostgreSQL with PVC

PostgreSQL + pgvector included in `helm/jaar/` with a PVC. Self-contained for local dev. External DB configurable via `AGENT_REGISTRY_DATABASE_URL` for production.

### 7. Upstream Helm chart as dependency

`helm/jaar/` is a thin wrapper chart that depends on the official `agentregistry` chart from `oci://ghcr.io/agentregistry-dev/agentregistry/charts` (v0.3.3). Only JAAR-specific templates are added: `namespace.yaml` (Istio sidecar injection label) and `httproute.yaml` (host-based routing). Upstream chart manages deployment, service, and bundled PostgreSQL.

*Originally planned*: Vendored chart — abandoned because the upstream chart already exposes all needed configuration and JAAR-specific needs (namespace, HTTPRoute) can be added as wrapper templates.

### 8. MCP server rewrite at `artifacts/servers/jarvis/`

The existing `mcp_server/` was replaced with a new MCP server scaffolded via `arctl mcp init python` at `artifacts/servers/jarvis/`. The new server uses FastMCP with dynamic tool loading from `src/tools/` and `mcp.yaml` as its artifact metadata (the arctl convention). Tools cover task, daily, and weekly management — backend-managed data only (no JIRA/GCal proxy).

*Originally planned*: Simple copy to `artifacts/servers/jarvis-mcp/` — replaced by a full rewrite to leverage the arctl scaffold structure and dynamic tool loading pattern.

## Risks / Trade-offs

**BREAKING: All JARVIS URLs shift from `/*` to `/jarvis/*`** → Root `/` redirect mitigates bookmark breakage. MCP server's `BACKEND_URL` must update. Deploy as a coordinated cutover, not rolling.

**Resource overhead (~512 MB RAM)** → Default Minikube (8 GB) should absorb it. Document `MINIKUBE_MEMORY` bump option in Makefile.

**Vendored chart drift** → Pin upstream version in `Chart.yaml`. Manual reconciliation on major upstream changes. Acceptable given low expected churn.

**Single-instance PostgreSQL with PVC** → Data loss on PVC deletion is expected for dev. Production requires migration to managed DB via env var.

**MCP server relocation churn** → Dockerfile, Helm chart, CI workflow, and import paths all change. One-time cost that prevents two competing patterns for server artifacts.

## Migration Plan

1. **Chunk 1 — Deploy JAAR standalone**: `helm/jaar/` chart + ArgoCD app. JAAR accessible internally only. No JARVIS changes. Validates AgentRegistry starts with bundled PostgreSQL.

2. **Chunk 2 — Routing restructure** (breaking change): Update JARVIS HTTPRoute to `/jarvis/*`, deploy JAAR HTTPRoute for `/jaar/*`, add root redirect, update frontend base path. Relocate MCP server to `artifacts/servers/jarvis-mcp/` and update Helm references.

3. **Chunk 3 — Dashboard card**: Additive. Agent Registry card on dashboard with artifact counts.

4. **Chunk 4 — Artifacts CI**: Manifest structure for remaining artifact types + GitHub Actions workflow for GHCR publishing.

Chunks 3 and 4 can proceed in parallel after Chunk 2.

**Rollback**: Delete JAAR ArgoCD app, revert HTTPRoute to catch-all, revert frontend base path, move MCP server back. No data migration needed.

## Open Questions

- Should the `artifacts/` directory include a top-level manifest or registry configuration file, or is per-artifact manifest sufficient?
- What is the exact GHCR package naming convention for artifacts (e.g., `ghcr.io/alchemesh-io/jarvis-mcp`)?
- Should Chunk 2 (routing + MCP relocation) be split into two sub-chunks to reduce blast radius?
