## 1. Backend Models & Migration

- [x] 1.1 Add `WorkerState` and `WorkerType` enums to `backend/app/models/enums.py`
- [x] 1.2 Create `Repository` ORM model in `backend/app/models/repository.py` with `id`, `git_url`, `branch` columns and unique constraint on `(git_url, branch)`
- [x] 1.3 Create `WorkerRepository` association model in `backend/app/models/worker_repository.py` with composite primary key `(worker_id, repository_id)`
- [x] 1.4 Create `Worker` ORM model in `backend/app/models/worker.py` with `id` (String(32)), `task_id` (FK, unique), `type`, `state`, `created_at`, `updated_at`, and relationships to `Task` and `Repository`
- [x] 1.5 Add `worker` relationship (one-to-one, `uselist=False`) to the existing `Task` model
- [x] 1.6 Update `backend/app/models/__init__.py` to export new models
- [x] 1.7 Generate Alembic migration for `worker`, `repository`, and `worker_repository` tables
- [x] 1.8 Write tests for model relationships, constraints, and cascade deletes

## 2. Backend Pydantic Schemas

- [x] 2.1 Create `backend/app/schemas/repository.py` with `RepositoryCreate`, `RepositoryResponse` schemas
- [x] 2.2 Create `backend/app/schemas/worker.py` with `WorkerCreate`, `WorkerUpdate`, `WorkerResponse`, `WorkerSummary` schemas (including `effective_state` field)
- [x] 2.3 Update `backend/app/schemas/task.py` to add optional `worker: WorkerSummary | None` field to `TaskResponse`

## 3. Backend Repository API

- [x] 3.1 Create `backend/app/routes/repositories.py` with CRUD endpoints: `POST /repositories`, `GET /repositories`, `GET /repositories/{id}`, `DELETE /repositories/{id}`
- [x] 3.2 Implement 409 conflict on duplicate `(git_url, branch)` creation
- [x] 3.3 Implement 409 conflict on delete when repository is in use by active worker
- [x] 3.4 Register repository router in `backend/app/main.py`
- [x] 3.5 Write tests for all repository CRUD endpoints

## 4. Backend Kubernetes Client

- [x] 4.1 Add `kubernetes` Python package to `backend/pyproject.toml`
- [x] 4.2 Create `backend/app/services/k8s.py` with functions: `create_worker_pod`, `create_worker_service`, `create_worker_httproute`, `delete_worker_resources`, `get_worker_pod_status`
- [x] 4.3 Implement in-cluster config detection with fallback to `~/.kube/config` for local dev
- [x] 4.4 Implement graceful degradation (503) when no cluster is available
- [x] 4.5 Write unit tests for k8s service (mocked Kubernetes client)

## 5. Backend Worker API

- [x] 5.1 Create `backend/app/routes/workers.py` with endpoints: `POST /workers`, `GET /workers`, `GET /workers/{id}`, `PATCH /workers/{id}`, `DELETE /workers/{id}`
- [x] 5.2 Implement worker creation: generate UUID hex ID, create DB record, trigger K8s pod/service/httproute creation
- [x] 5.3 Implement 409 conflict when task already has a worker
- [x] 5.4 Implement `GET /workers/{id}` with effective state merging (DB state + pod status endpoint query)
- [x] 5.5 Implement worker archive: delete K8s resources, set state to `archived`
- [x] 5.6 Implement worker delete: delete K8s resources, delete DB record
- [x] 5.7 Register worker router in `backend/app/main.py`
- [x] 5.8 Update task list/detail endpoints to include `worker` summary in response
- [x] 5.9 Write tests for all worker CRUD endpoints and state transitions

## 6. Backend Task-Worker Cascade

- [x] 6.1 Implement cascade logic: when a task is deleted, clean up worker K8s resources before the DB cascade deletes the worker record
- [x] 6.2 Write tests for task deletion with active worker

## 7. Helm Templates — RBAC & ConfigMap

- [x] 7.1 Create `helm/jarvis/templates/worker-serviceaccount.yaml` with ServiceAccount for the backend
- [x] 7.2 Create `helm/jarvis/templates/worker-role.yaml` with Role granting permissions for pods, services, httproutes in `jarvis` namespace
- [x] 7.3 Create `helm/jarvis/templates/worker-rolebinding.yaml` binding the Role to the ServiceAccount
- [x] 7.4 Update `helm/jarvis/templates/backend-deployment.yaml` to use the new ServiceAccount
- [x] 7.5 Create `helm/jarvis/templates/worker-claude-config.yaml` ConfigMap with Claude config file keys
- [x] 7.6 Add worker-related values to `helm/jarvis/values.yaml` (worker image, resource limits, Claude config paths)

## 8. Worker Docker Image

- [x] 8.1 Create `worker/` directory at project root with `Dockerfile`, `entrypoint.sh`, and `status-server/` subdirectory
- [x] 8.2 Write the Dockerfile: `node:22-slim` base, install Claude Code npm package (pinned version), Python 3.12, uv, git, curl, jq, arctl
- [x] 8.3 Write the entrypoint script: copy Claude config, configure MCP server, clone repos, pull skills, start Claude Code + worker UI + status server
- [x] 8.4 Write the status endpoint server (minimal Node.js HTTP server on port 8080, inspects Claude Code process state)
- [x] 8.5 Integrate erdrix/claude-code as the worker chat UI (vendor built assets, serve on port 3000)
- [x] 8.6 Set non-root user (UID 1000), create `~/jarvis` and `~/.claude` directories
- [x] 8.7 Test the Docker image builds successfully and all tools are available

## 9. Makefile Updates

- [x] 9.1 Add `build-worker` target to build the worker Docker image
- [x] 9.2 Update `deploy-local` target to build and load the worker image into Minikube
- [x] 9.3 Add `sync-claude-config` target to create/update the `jarvis-claude-config` ConfigMap from host files
- [x] 9.4 Update `jarvis-ui` target to include `jaw.jarvis.io` in the hosts instructions output

## 10. Gateway Routing

- [x] 10.1 Verify `jaw.jarvis.io` is already covered by the `*.jarvis.io` wildcard on the Istio gateway (no gateway changes needed)
- [x] 10.2 Implement dynamic HTTPRoute creation in the K8s service (`backend/app/services/k8s.py`): match `jaw.jarvis.io` + path prefix `/<worker_id>/`, route to `jarvis-worker-<worker_id>:3000`, strip prefix
- [x] 10.3 Test HTTPRoute creation and deletion for a worker lifecycle

## 11. Frontend API Client

- [x] 11.1 Add `WorkerState`, `WorkerType`, `Worker`, `WorkerSummary`, `Repository` TypeScript types to `frontend/src/api/client.ts`
- [x] 11.2 Add worker API functions: `createWorker`, `listWorkers`, `getWorker`, `updateWorker`, `deleteWorker`
- [x] 11.3 Add repository API functions: `createRepository`, `listRepositories`, `getRepository`, `deleteRepository`
- [x] 11.4 Update `Task` interface to include `worker: WorkerSummary | null`

## 12. Frontend Workers Page

- [x] 12.1 Create `frontend/src/pages/Workers/Workers.tsx` with page layout (repository panel + worker card grid)
- [x] 12.2 Create `frontend/src/pages/Workers/Workers.css` with styles following JADS design system
- [x] 12.3 Implement repository management panel: add form (git URL + branch), list with delete buttons, error handling for duplicates and in-use repos
- [x] 12.4 Implement worker card grid: responsive layout, card rendering with ID, task title, type badge, state indicator (color-coded), creation timestamp
- [x] 12.5 Implement worker card click: open `jaw.jarvis.io/<worker_id>` in new tab
- [x] 12.6 Implement worker creation form: task dropdown (filtered to tasks without workers), repository multi-select, type selector, create button
- [x] 12.7 Implement worker deletion from card with confirmation dialog
- [x] 12.8 Add `/workers` route to `frontend/src/App.tsx` and "Workers" link to the navigation header

## 13. Frontend Task-Worker Integration

- [x] 13.1 Update `TaskCard` component (in JADS or TaskBoard) to display worker status indicator icon with color coding when a worker exists
- [x] 13.2 Add play button to `TaskCard` for tasks without workers
- [x] 13.3 Implement play button click: open worker creation dialog pre-filled with the task, repository multi-select, create button
- [x] 13.4 Implement worker status indicator click: open `jaw.jarvis.io/<worker_id>` in new tab
- [x] 13.5 Add VSCode icon button to `TaskCard` for tasks with active (non-archived) workers
- [x] 13.6 Implement VSCode icon click: open `vscode://` URI targeting the worker pod in `jarvis` namespace

## 14. MCP Server Tools

- [x] 14.1 Create `artifacts/servers/jarvis/src/tools/workers.py` with tools: `create_worker`, `list_workers`, `get_worker`, `update_worker`, `delete_worker`
- [x] 14.2 Create `artifacts/servers/jarvis/src/tools/repositories.py` with tools: `create_repository`, `list_repositories`, `delete_repository`
- [x] 14.3 Write tests for the new MCP tools

## 15. Documentation & CI

- [x] 15.1 Update `CLAUDE.md` repository structure section to include `worker/` directory and new Helm templates
- [x] 15.2 Update `.github/workflows/docker-publish.yml` to build and push the worker Docker image to GHCR
- [x] 15.3 Add `jaw.jarvis.io` to the known limitations table and routing documentation in `CLAUDE.md`
