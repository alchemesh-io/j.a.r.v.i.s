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

### 2. Prefix-based routing with URL rewrite over subdomain routing

Ingress uses path prefixes (`/jarvis/*`, `/jaar/*`) with Istio `URLRewrite` filters that strip the prefix before forwarding. Neither backend sees the prefix — zero code changes needed. Works out of the box with `minikube tunnel` on a single IP.

A root `/` redirect to `/jarvis` preserves usability.

*Alternative*: Subdomains (`jarvis.local`, `jaar.local`) would require `/etc/hosts` edits or local DNS, adding friction to every developer setup.

### 3. HTTPRoute per namespace, attached to shared Gateway

Each namespace owns its own HTTPRoute, referencing the shared Istio Gateway via `parentRefs`. Keeps Helm charts self-contained with no `ReferenceGrant` objects needed.

*Alternative*: Centralized HTTPRoute would require cross-namespace backend refs and couple the two Helm releases.

### 4. Frontend calls AgentRegistry directly through the gateway

The JARVIS frontend calls `/jaar/v0/*` from the browser. Same ingress domain means no CORS issues. No backend proxy needed.

*Alternative*: Backend proxy would add latency and coupling between independent services for no benefit.

### 5. Anonymous auth only

`ENABLE_ANONYMOUS_AUTH=true`, no OAuth/OIDC. Internal-only deployment. Auth can be layered later via Istio authorization policies or AgentRegistry's own mechanisms.

### 6. Bundled PostgreSQL with PVC

PostgreSQL + pgvector included in `helm/jaar/` with a PVC. Self-contained for local dev. External DB configurable via `AGENT_REGISTRY_DATABASE_URL` for production.

### 7. Vendored Helm chart over upstream dependency

Chart vendored and adapted in `helm/jaar/` for full control: Istio sidecar labels, HTTPRoute (not Ingress), JARVIS conventions. Upstream version pinned in `Chart.yaml`.

*Alternative*: Upstream chart dependency wouldn't expose the structural adaptations needed (namespace labels, Gateway API routing).

### 8. MCP server relocation to `artifacts/servers/jarvis-mcp/`

The existing `mcp_server/` directory moves under the artifacts structure as the first registry-managed server artifact. This establishes the convention: one folder per artifact type, each artifact in its own subfolder with manifest + source. Helm chart Dockerfile paths and CI workflow paths update accordingly.

*Alternative*: Keeping `mcp_server/` separate would mean two different patterns for managing server artifacts.

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
