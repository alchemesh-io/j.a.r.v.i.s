## Context

JARVIS is a multi-agent personal assistant running on Minikube with ArgoCD-managed Helm charts, Istio gateway routing (`*.jarvis.io`), a FastAPI/SQLite backend, and a React/Vite frontend. Tasks exist as data objects but have no execution layer. Workers introduce containerized Claude Code sessions — one pod per worker — each tied to a JARVIS task, with git repositories cloned, skills pulled from JAAR, and an interactive chat UI accessible via the gateway.

The backend uses synchronous SQLAlchemy 2 with SQLite (WAL mode), Alembic for migrations, and Pydantic 2 for all request/response schemas. The frontend uses React 19, TanStack Query, React Router v7, and the `@jarvis/jads` design system. All traffic enters through the Istio ingress gateway on `*.jarvis.io` with host-based routing.

## Goals / Non-Goals

**Goals:**
- Define a Worker lifecycle (Initialized → Working → Waiting for human → Done → Archived) managed by the backend and reflected in real-time on the frontend
- Enable one-click worker creation from any task, with configurable repositories and skills
- Provide a chat UI for interacting with the Claude Code session running inside a worker pod
- Route all worker traffic through `jaw.jarvis.io/<worker_id>` via the Istio gateway
- Keep worker pods self-contained: each pod runs its own Claude Code session, worker UI, and status endpoint
- Synchronize Claude configuration files from the host into every worker pod via ConfigMap + init container
- Support VSCode Remote connections to worker pods for direct IDE access

**Non-Goals:**
- Horizontal scaling of workers (one pod = one session, no replicas)
- Worker-to-worker communication or orchestration
- GitHub Copilot or other non-Claude worker types (model field reserved for future use)
- Persistent storage for worker pods beyond the session lifetime (git state is ephemeral)
- Authentication or RBAC for worker access (local dev cluster, single user)
- Automated worker garbage collection (user manually archives/deletes)

## Decisions

### D1: Worker ID format — UUID v4, lowercase hex without hyphens

Worker IDs must double as Claude Code session IDs. Claude Code session IDs are alphanumeric strings. Using UUID v4 with hyphens stripped (32-char hex) satisfies both the database primary key requirement and Claude Code's session ID format. The backend generates the ID on worker creation.

**Alternatives considered:**
- Auto-increment integer: doesn't work as a Claude Code session ID; would need a separate session_id field
- Slugified task title: collisions, encoding issues in URLs
- UUID with hyphens: hyphens may cause issues in some CLI contexts; stripping is simpler

### D2: Worker pods created dynamically via Kubernetes API, not Helm

Workers are ephemeral, per-task resources. Managing them as Helm-deployed Deployments would require dynamic values files and ArgoCD syncs per worker, which is impractical. Instead, the backend uses the Kubernetes Python client (`kubernetes` package) to create/delete pods directly in the `jarvis` namespace.

Each worker gets:
- A Pod (not Deployment — single instance, no replicas needed)
- A Service (`jarvis-worker-<worker_id>`) for stable in-cluster DNS

The backend needs a ServiceAccount with RBAC permissions to create/delete pods and services in the `jarvis` namespace. This is deployed via Helm as a static ServiceAccount + Role + RoleBinding.

**Alternatives considered:**
- Helm + ArgoCD per worker: too heavy for ephemeral resources; sync latency unacceptable
- Jobs: wrong abstraction — workers are long-running, not run-to-completion
- StatefulSets: overkill for single-instance pods with no persistent state

### D3: Worker pod architecture — single pod with three processes

Each worker pod runs three processes managed by a lightweight entrypoint script:

1. **Claude Code session** — `claude --session-id <worker_id> --resume` (main process)
2. **Worker UI** — a web server serving the chat interface (based on erdrix/claude-code), bound to port 3000
3. **Status endpoint** — a minimal HTTP server on port 8080 reporting worker state by inspecting the Claude Code process

The entrypoint script:
1. Copies Claude config from init-volume to `~/.claude/` and `~/.claude.json`
2. Clones all git repositories into `~/jarvis/`
3. Pulls skills from JAAR using `arctl`
4. Configures the JARVIS MCP server in Claude Code settings
5. Starts the Claude Code session, worker UI, and status endpoint

**Alternatives considered:**
- Sidecar containers: adds complexity for inter-container communication; a single container with supervised processes is simpler for this use case
- Separate pods per concern: unnecessary network hops and coordination overhead

### D4: Worker state derived from pod inspection, not stored exclusively in DB

The backend stores the "intended" state (Initialized, Done, Archived), but the "live" state (Working vs. Waiting for human) is derived by querying the worker pod's status endpoint. This avoids state drift between the database and the actual pod.

State mapping:
| Pod status | DB state | Effective state |
|---|---|---|
| Pod pending/creating | initialized | Initialized |
| Claude Code active (writing output) | initialized | Working |
| Claude Code idle (waiting for input) | initialized | Waiting for human |
| User explicitly finished | done | Done |
| Pod deleted / user archived | archived | Archived |

The `GET /api/v1/workers/{id}` endpoint merges DB state with live pod state when the pod exists.

**Alternatives considered:**
- Purely DB-driven state with webhook updates from pod: adds complexity, still drifts if pod dies
- Purely pod-driven state: loses history when pod is deleted; can't represent "Archived"

### D5: Repository model — standalone entity with many-to-many to Worker

Repositories are global resources (URL + branch must be unique across JARVIS). Workers reference repositories via a join table (`worker_repository`). This allows:
- Repository reuse across multiple workers
- Central repository management (add once, use many times)
- Validation of uniqueness at the database level

The Repository model: `id`, `git_url`, `branch` (default "main"), with a unique constraint on `(git_url, branch)`.

**Alternatives considered:**
- Repositories embedded in Worker as JSON: no referential integrity, can't enforce global uniqueness
- Repositories as a Worker sub-resource only: prevents reuse

### D6: Gateway routing — `jaw.jarvis.io` with path-based per-worker routing

A new HTTPRoute in the jarvis Helm chart matches `jaw.jarvis.io` and routes `/<worker_id>/*` to the corresponding worker service (`jarvis-worker-<worker_id>:3000`). Since worker services are created dynamically, the HTTPRoute must also be managed dynamically by the backend (not Helm).

The backend creates an HTTPRoute per worker alongside the pod and service. The route strips the `/<worker_id>` prefix before forwarding to the worker UI.

The status endpoint is accessed internally by the backend (`http://jarvis-worker-<worker_id>.jarvis.svc:8080/status`) — it is not exposed through the gateway.

**Alternatives considered:**
- Single catch-all HTTPRoute with regex: Gateway API doesn't support regex path matching well
- Port-based routing: impractical for dynamic workers
- Reverse proxy in the backend: adds latency and backend coupling

### D7: Worker Docker image — based on Node.js with Claude Code npm package

The worker image uses `node:22-slim` as the base (Claude Code is an npm package). Layers:

1. `node:22-slim` base
2. Install `@anthropic-ai/claude-code` at a pinned version via npm
3. Install Python 3.12 + `uv` (for MCP server compatibility and arctl)
4. Install `git`, `curl`, `jq` for repository cloning and skill pulling
5. Install `arctl` CLI
6. Copy the worker UI application (built from erdrix/claude-code)
7. Copy the status endpoint server
8. Copy the entrypoint script
9. Create `~/jarvis` workdir and `~/.claude` config directory
10. Set non-root user (UID 1000)

**Alternatives considered:**
- Python-based image with Node.js added: Claude Code is Node-native, starting from Node is more natural
- Alpine base: compatibility issues with npm native modules

### D8: Claude configuration sync — ConfigMap with init container copy

A Helm-managed ConfigMap (`jarvis-claude-config`) contains the four Claude config files sourced from the host. The ConfigMap is populated by a Makefile target that reads from well-known paths on the developer's machine.

Worker pods mount this ConfigMap as a read-only volume at `/init-claude-config/`. The entrypoint script copies these files to the correct locations (`~/.claude/` and `~/`) before starting Claude Code.

Files synced:
- `~/.claude/policy-limits.json` → ConfigMap key `policy-limits.json`
- `~/.claude/remote-settings.json` → ConfigMap key `remote-settings.json`
- `~/.claude.json` → ConfigMap key `claude.json`
- `~/.claude/settings.json` → ConfigMap key `settings.json`

**Alternatives considered:**
- Mount directly to `~/.claude/`: read-only mount conflicts with Claude Code writing to `~/.claude/`
- Kubernetes Secret instead of ConfigMap: these files don't contain secrets (API keys are in separate Secrets)

### D9: VSCode Remote — `vscode://` URI scheme with Kubernetes extension

The frontend generates a `vscode://` URI that opens VSCode with the Kubernetes extension targeting the worker pod. The URI includes the pod name, namespace, and a command to run the Claude Code session in the terminal. This requires the user to have the Kubernetes VSCode extension installed locally.

**Alternatives considered:**
- code-server running in the pod: significant resource overhead per worker
- SSH-based remote: requires sshd in the container and key management

### D10: Backend Kubernetes client — in-cluster ServiceAccount

The backend pod runs with a ServiceAccount that has permissions to manage pods, services, and HTTPRoutes in the `jarvis` namespace. The `kubernetes` Python client auto-detects in-cluster config. A new Helm template defines the ServiceAccount, Role, and RoleBinding.

For local development outside the cluster (`make dev-backend`), the Kubernetes client falls back to `~/.kube/config` (Minikube context). The backend gracefully degrades if no cluster is available — worker creation returns a 503.

## Risks / Trade-offs

**[Single-process Claude Code session per pod]** → If the Claude Code process crashes, the worker is effectively dead. Mitigation: the status endpoint detects process death and reports it; the UI shows an error state with a "restart" option that deletes and recreates the pod.

**[SQLite single-writer bottleneck with K8s API calls]** → Worker creation involves synchronous K8s API calls (create pod, service, httproute) within a request. This blocks the single-writer SQLite. Mitigation: K8s operations happen after the DB commit; if K8s creation fails, the worker record is updated to an error state. Future: move to PostgreSQL and async K8s client.

**[Dynamic HTTPRoute management outside ArgoCD]** → ArgoCD doesn't manage worker HTTPRoutes, so `argocd app sync` won't clean them up. Mitigation: worker deletion explicitly removes the HTTPRoute; an orphan cleanup mechanism can be added later.

**[ConfigMap staleness]** → Claude config changes on the host aren't automatically propagated to running workers. Mitigation: document the need to redeploy/restart workers after config changes; add a `make sync-claude-config` target.

**[Worker pod resource consumption]** → Each worker pod runs Claude Code + Node.js UI + status server, consuming ~512MB–1GB RAM. Minikube clusters may run out of resources with multiple workers. Mitigation: document minimum resource requirements; set resource requests/limits in the pod spec.

**[erdrix/claude-code dependency]** → The worker UI depends on an external repository. If the project's API changes, the worker UI breaks. Mitigation: pin to a specific commit/tag; vendor the built assets into the worker Docker image.

## Migration Plan

No data migration needed — this is a new feature with new tables. Deployment steps:

1. Apply Alembic migration (auto-runs on backend startup) to create `worker`, `repository`, and `worker_repository` tables
2. Deploy updated backend with new routes and Kubernetes client
3. Deploy updated frontend with Workers page and task integration
4. Build and load the worker Docker image into Minikube
5. Apply updated Helm chart with ServiceAccount, Role, RoleBinding, and Claude config ConfigMap
6. Update `/etc/hosts` to add `jaw.jarvis.io` pointing to the gateway IP
7. Add `jaw.jarvis.io` to the Makefile `jarvis-ui` output

Rollback: delete the ArgoCD app and revert to the previous commit. Worker pods in the cluster can be cleaned up with `kubectl delete pods -l app=jarvis-worker -n jarvis`.

## Open Questions

1. **Claude Code session ID requirements** — What exact character set and length does Claude Code accept for `--session-id`? Need to verify against the actual CLI to confirm UUID-hex works.
2. **erdrix/claude-code integration depth** — Should the worker UI be a fork, a vendored build, or consumed as an npm dependency? Need to inspect the repository structure.
3. **Skill pulling at init vs. on-demand** — Should all JAAR skills be pulled during pod init (slower startup, guaranteed availability) or pulled on-demand by Claude Code (faster startup, potential runtime failures)?
4. **Worker restart semantics** — When a worker is "restarted", should the Claude Code session history be preserved (requires volume persistence) or start fresh?
5. **Maximum concurrent workers** — Should there be a configurable limit to prevent resource exhaustion, or leave it to Kubernetes resource quotas?

## Implementation Additions

The following decisions were made during implementation and extend the original design.

### D11: Hook-based state reporting — not process polling

The original design (D4) described deriving live worker state by inspecting the Claude Code process from the status endpoint. In practice, Claude Code hooks provide a more reliable mechanism: `PreToolUse` fires when Claude starts working, and `Stop`/`Notification` fire when it finishes. The `setup-claude.sh` script configures these hooks to write the current state to `/tmp/claude-state`. The status server reads from this file and pushes state to the backend via `PATCH /api/v1/workers/{id}` every 3 seconds. This replaces the pull-based model (backend polling the pod) with a push-based model (pod pushing state to the backend).

**Alternatives considered:**
- Process stdout/stderr parsing: fragile, depends on Claude Code output format
- Polling from backend to pod status endpoint: higher latency, more network traffic, complicates backend with async polling loops

### D12: Dedicated JAW secret — separate from backend secret

Worker pods need credentials (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `GITHUB_TOKEN`) that differ from the backend's secrets. A dedicated Kubernetes Secret (`jarvis-jaw-secret`) is created in the `jarvis` namespace, deployed via a separate Makefile target (`_deploy-jaw-secrets`) from `secrets/jaw-secret.yaml`. This keeps worker credentials isolated and allows rotation without affecting the backend.

**Alternatives considered:**
- Shared backend secret with additional keys: couples backend and worker credential lifecycles; worker needs tokens (e.g., GITHUB_TOKEN) that backend does not
- Per-worker secrets: too granular for local dev; all workers share the same credentials

### D13: VSCode Dev Containers via k8s-container URI — not SSH

The original design (D9) mentioned VSCode Kubernetes extension for remote access. The implementation uses the Dev Containers extension with the `k8s-container` URI scheme: `vscode://vscode-remote/k8s-container+<hex-encoded-context-and-pod>/home/node`. A dedicated backend endpoint `GET /api/v1/workers/{id}/vscode-uri` generates this URI, encoding the `KUBE_CONTEXT` (configurable via env var, default `"minikube"`), namespace, pod name, and container name into the hex payload. The SSH approach was abandoned as it requires sshd in the container and key management.

**Alternatives considered:**
- SSH with key injection: requires sshd, key management, port exposure — complexity not justified for local dev
- Kubernetes extension `attach` command: less integrated than Dev Containers; doesn't provide a full IDE workspace

### D14: Claude Code non-interactive mode via named pipe + stream-json

Claude Code runs in `--print --input-format stream-json --output-format stream-json --dangerously-skip-permissions` mode, receiving input through a named pipe. The worker UI writes user messages to the named pipe, and Claude Code streams responses back as JSON. This avoids the complexities of PTY emulation and provides structured input/output. Claude Code version is pinned at 2.1.104.

**Alternatives considered:**
- PTY-based interactive session: harder to parse output, TTY escape codes contaminate streams
- `--resume` with session files: requires persistent storage; stream-json is more reliable for programmatic interaction

### D15: Repository page as separate tab — not inline on Workers page

The original UI spec placed repositories as a collapsible panel on the Workers page. During implementation, repositories were moved to a dedicated `/repositories` route with a `TabNav` component (`Workers | Repositories`). This provides more space for rich repository cards (platform icon, owner, name, branch badge, worker counts) and separates concerns. The `TabNav` pattern (`WorkerNav`) is shared with `BoardNav` for consistency.

**Alternatives considered:**
- Inline collapsible panel: cramped UI, especially with rich repo cards showing worker counts
- Modal dialog: loses context; repositories are a first-class management concern, not a secondary action
