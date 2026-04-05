## Short description

Implement J.A.W (Just Another Worker) — a persistent Claude Code sandbox deployed as a Kubernetes pod, triggered by the backend, that can receive multiple commands over its lifetime without being killed.

## Context

J.A.R.V.I.S needs execution capabilities. J.A.W is a long-lived worker that runs Claude Code inside `@anthropic-ai/sandbox-runtime` for OS-level isolation (filesystem + network). The backend manages worker lifecycle and proxies commands to the J.A.W service. Workers maintain conversation context across commands using Claude Code's `--continue` flag. No MCP connectivity in this iteration.

### Worker state machine

```
Initializing → Initialized → Working → Initialized  (command done, ready for more)
                                     → Waiting for human → Working  (human responds)

From any active state → Done → Archived
```

- **Initializing**: worker starting up, setting up workspace
- **Initialized**: ready to accept commands
- **Working**: processing a command via Claude Code
- **Waiting for human**: Claude Code needs human input/approval
- **Done**: explicitly finished, no more commands accepted
- **Archived**: cleaned up, workspace deleted

## Implementation details

### Chunk 1 \- J.A.W service (Node.js)

Create a new `jaw/` component at the repository root. This is a thin Node.js HTTP service wrapping Claude Code executions inside `@anthropic-ai/sandbox-runtime`.

* **`jaw/package.json`**: Dependencies: `express`, `@anthropic-ai/sandbox-runtime`, `uuid`. Script: `start` → `node server.js`
* **`jaw/server.js`**: Express server on port 3000 (configurable via `PORT` env var) with the following endpoints:
  * `POST /workers` — creates a worker directory at `/workspaces/<worker_id>/`, sets status to `initializing` then `initialized`. Returns `{ worker_id, status }`
  * `POST /workers/:id/commands` — accepts `{ prompt }`, spawns `npx @anthropic-ai/sandbox-runtime claude --print --output-format json --continue -p "<prompt>"` in the worker's workspace. Sets status to `working`. Returns `{ command_id, status }`
  * `POST /workers/:id/respond` — accepts `{ input }`, sends human response to the worker (new `--continue` call with the input as prompt). Sets status back to `working`
  * `GET /workers/:id` — returns worker status + command history with outputs
  * `GET /workers` — lists all workers with status summary
  * `DELETE /workers/:id` — cleans up worker workspace directory, sets status to `archived`
* **Worker isolation**:
  * Each worker gets a dedicated directory under `/workspaces/<worker_id>/` for workspace files
  * `HOME` env var set to `/workspaces/<worker_id>/` so Claude Code state (conversation history) persists across commands via `--continue`
  * Child process environment: `ANTHROPIC_API_KEY` (from pod env), `DISABLE_AUTOUPDATER=1`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`
* **State enforcement**: commands only accepted when worker is `initialized`, respond only when `waiting_for_human`
* **In-memory store**: `Map<worker_id, { status, workspace_path, commands: [{ id, prompt, output, error, status }], created_at }>`

### Chunk 2 \- J.A.W Docker image

* **`jaw/Dockerfile`**: Multi-stage Node.js 22 slim image
  * Install `@anthropic-ai/claude-code` globally via npm
  * Copy and install service dependencies (`npm ci --production`)
  * Create non-root user `jaw` (UID 1000) and `/workspaces` directory owned by that user
  * Expose port 3000
  * `CMD ["node", "server.js"]`

### Chunk 3 \- Backend data model

Create the ORM models and Pydantic schemas following the existing patterns (see `backend/app/models/task.py`, `backend/app/schemas/task.py`).

* **Add `JawWorkerStatus` enum** to `backend/app/models/enums.py`: `initializing`, `initialized`, `working`, `waiting_for_human`, `done`, `archived`
* **Create `backend/app/models/jaw.py`** with two ORM models:
  * `JawWorker`: `id` (int PK), `worker_id` (str UUID unique), `name` (str nullable), `status` (JawWorkerStatus), `created_at` (datetime), `updated_at` (datetime)
  * `JawCommand`: `id` (int PK), `command_id` (str UUID unique), `worker_id` (int FK → jaw_worker.id, cascade delete), `prompt` (text), `output` (text nullable), `error` (text nullable), `created_at` (datetime), `completed_at` (datetime nullable)
* **Create `backend/app/schemas/jaw.py`**:
  * `JawWorkerCreate`: `name: str | None = None`
  * `JawWorkerResponse`: all fields + `commands: list[JawCommandResponse]`
  * `JawWorkerListResponse`: summary fields (no commands, no full output)
  * `JawWorkerUpdate`: `status: JawWorkerStatus` (for done/archive transitions only)
  * `JawCommandCreate`: `prompt: str`
  * `JawCommandResponse`: all command fields
  * `JawRespondCreate`: `input: str`
* **Alembic migration**: auto-generate for `jaw_worker` + `jaw_command` tables

### Chunk 4 \- Backend service client and configuration

* **Create `backend/app/services/jaw_client.py`**: httpx client calling the J.A.W service
  * `create_worker() -> worker_id`
  * `send_command(worker_id, prompt) -> command_id`
  * `send_response(worker_id, input) -> None`
  * `get_worker(worker_id) -> dict` (status + commands)
  * `delete_worker(worker_id) -> None`
  * Base URL from config setting `JAW_SERVICE_URL`
* **Add `JawConfig`** to `backend/app/config.py` following the `JiraConfig`/`GoogleCalendarConfig` pattern:
  * `enabled: bool = False`
  * `service_url: str = "http://jarvis-jaw:3000"`
  * `configured` property returns `enabled`
  * Add flat settings `jaw_enabled`, `jaw_service_url` on `Settings`
  * Add `jaw` property on `Settings` returning `JawConfig`
* **Move `httpx`** from dev to main dependencies in `backend/pyproject.toml`

### Chunk 5 \- Backend API routes

Create `backend/app/routes/jaw.py` and register it in `backend/app/main.py` under `/api/v1`:

* `POST /jaw/workers` — creates worker record in DB, calls `jaw_client.create_worker()`, returns 201 with `JawWorkerResponse`
* `POST /jaw/workers/{worker_id}/commands` — validates worker is `initialized`, calls `jaw_client.send_command()`, creates `JawCommand` in DB, returns `JawCommandResponse`
* `POST /jaw/workers/{worker_id}/respond` — validates worker is `waiting_for_human`, calls `jaw_client.send_response()`, returns updated status
* `PATCH /jaw/workers/{worker_id}` — accepts `JawWorkerUpdate`, transitions to `done` or `archived` (calls `jaw_client.delete_worker()` on archive)
* `GET /jaw/workers/{worker_id}` — refreshes status from J.A.W service, updates DB, returns `JawWorkerResponse` with command history
* `GET /jaw/workers` — lists workers from DB, returns `list[JawWorkerListResponse]`
* All endpoints return 503 if `settings.jaw.configured` is `False`

### Chunk 6 \- Helm chart

* **Update `helm/jarvis/values.yaml`**: add `jaw` section with `enabled`, `image` (repository, tag, pullPolicy), `replicaCount: 1`, `service.port: 3000`, `resources.limits` (cpu: "1", memory: 1Gi)
* **Create `helm/jarvis/templates/jaw-deployment.yaml`**: Deployment following existing patterns (`mcp-deployment.yaml`)
  * Container on port 3000
  * Env: `ANTHROPIC_API_KEY` from secret ref, `PORT=3000`
  * Volume: emptyDir mounted at `/workspaces` for worker workspace isolation
  * Pod annotation: `sidecar.istio.io/inject: "false"` (avoid Istio sidecar complications with subprocess spawning)
* **Create `helm/jarvis/templates/jaw-service.yaml`**: ClusterIP service on port 3000 following `mcp-service.yaml` pattern
* **Update `helm/jarvis/templates/backend-configmap.yaml`**: add conditional `JAW_ENABLED` and `JAW_SERVICE_URL` env vars when `jaw.enabled`
* **Update `secrets/backend-secret.example.yaml`**: add documented `ANTHROPIC_API_KEY` entry

### Chunk 7 \- Build and deploy integration

* **Update `Makefile`**: add `jaw` image to `deploy-local` target (docker build + minikube image load) and `deploy` target (pull from GHCR + load)
* **Update `.github/workflows/docker-publish.yml`**: add jaw image build step following the existing backend/frontend pattern
