## 1. Backend Models & Migration

- [ ] 1.1 Add `WorkerState` and `WorkerType` enums to `backend/app/models/enums.py`
- [ ] 1.2 Create `Repository` ORM model in `backend/app/models/repository.py` with `id`, `git_url`, `branch` columns and unique constraint on `(git_url, branch)`
- [ ] 1.3 Create `WorkerRepository` association model in `backend/app/models/worker_repository.py` with composite primary key `(worker_id, repository_id)`
- [ ] 1.4 Create `Worker` ORM model in `backend/app/models/worker.py` with `id` (String(32)), `task_id` (FK, unique), `type`, `state`, `created_at`, `updated_at`, and relationships to `Task` and `Repository`
- [ ] 1.5 Add `worker` relationship (one-to-one, `uselist=False`) to the existing `Task` model
- [ ] 1.6 Update `backend/app/models/__init__.py` to export new models
- [ ] 1.7 Generate Alembic migration for `worker`, `repository`, and `worker_repository` tables
- [ ] 1.8 Write tests for model relationships, constraints, and cascade deletes

## 2. Backend Pydantic Schemas

- [ ] 2.1 Create `backend/app/schemas/repository.py` with `RepositoryCreate`, `RepositoryResponse` schemas
- [ ] 2.2 Create `backend/app/schemas/worker.py` with `WorkerCreate`, `WorkerUpdate`, `WorkerResponse`, `WorkerSummary` schemas (including `effective_state` field)
- [ ] 2.3 Update `backend/app/schemas/task.py` to add optional `worker: WorkerSummary | None` field to `TaskResponse`

## 3. Backend Repository API

- [ ] 3.1 Create `backend/app/routes/repositories.py` with CRUD endpoints: `POST /repositories`, `GET /repositories`, `GET /repositories/{id}`, `DELETE /repositories/{id}`
- [ ] 3.2 Implement 409 conflict on duplicate `(git_url, branch)` creation
- [ ] 3.3 Implement 409 conflict on delete when repository is in use by active worker
- [ ] 3.4 Register repository router in `backend/app/main.py`
- [ ] 3.5 Write tests for all repository CRUD endpoints

## 4. Backend Kubernetes Client

- [ ] 4.1 Add `kubernetes` Python package to `backend/pyproject.toml`
- [ ] 4.2 Create `backend/app/services/k8s.py` with functions: `create_worker_pod`, `create_worker_service`, `create_worker_httproute`, `delete_worker_resources`, `get_worker_pod_status`
- [ ] 4.3 Implement in-cluster config detection with fallback to `~/.kube/config` for local dev
- [ ] 4.4 Implement graceful degradation (503) when no cluster is available
- [ ] 4.5 Write unit tests for k8s service (mocked Kubernetes client)

## 5. Backend Worker API

- [ ] 5.1 Create `backend/app/routes/workers.py` with endpoints: `POST /workers`, `GET /workers`, `GET /workers/{id}`, `PATCH /workers/{id}`, `DELETE /workers/{id}`
- [ ] 5.2 Implement worker creation: generate UUID hex ID, create DB record, trigger K8s pod/service/httproute creation
- [ ] 5.3 Implement 409 conflict when task already has a worker
- [ ] 5.4 Implement `GET /workers/{id}` with effective state merging (DB state + pod status endpoint query)
- [ ] 5.5 Implement worker archive: delete K8s resources, set state to `archived`
- [ ] 5.6 Implement worker delete: delete K8s resources, delete DB record
- [ ] 5.7 Register worker router in `backend/app/main.py`
- [ ] 5.8 Update task list/detail endpoints to include `worker` summary in response
- [ ] 5.9 Write tests for all worker CRUD endpoints and state transitions

## 6. Backend Task-Worker Cascade

- [ ] 6.1 Implement cascade logic: when a task is deleted, clean up worker K8s resources before the DB cascade deletes the worker record
- [ ] 6.2 Write tests for task deletion with active worker

## 7. Helm Templates — RBAC & ConfigMap

- [ ] 7.1 Create `helm/jarvis/templates/worker-serviceaccount.yaml` with ServiceAccount for the backend
- [ ] 7.2 Create `helm/jarvis/templates/worker-role.yaml` with Role granting permissions for pods, services, httproutes in `jarvis` namespace
- [ ] 7.3 Create `helm/jarvis/templates/worker-rolebinding.yaml` binding the Role to the ServiceAccount
- [ ] 7.4 Update `helm/jarvis/templates/backend-deployment.yaml` to use the new ServiceAccount
- [ ] 7.5 Create `helm/jarvis/templates/worker-claude-config.yaml` ConfigMap with Claude config file keys
- [ ] 7.6 Add worker-related values to `helm/jarvis/values.yaml` (worker image, resource limits, Claude config paths)

## 8. Worker Docker Image

- [ ] 8.1 Create `worker/` directory at project root with `Dockerfile`, `entrypoint.sh`, and `status-server/` subdirectory
- [ ] 8.2 Write the Dockerfile: `node:22-slim` base, install Claude Code npm package (pinned version), Python 3.12, uv, git, curl, jq, arctl
- [ ] 8.3 Write the entrypoint script: copy Claude config, configure MCP server, clone repos, pull skills, start Claude Code + worker UI + status server
- [ ] 8.4 Write the status endpoint server (minimal Node.js HTTP server on port 8080, inspects Claude Code process state)
- [ ] 8.5 Integrate erdrix/claude-code as the worker chat UI (vendor built assets, serve on port 3000)
- [ ] 8.6 Set non-root user (UID 1000), create `~/jarvis` and `~/.claude` directories
- [ ] 8.7 Test the Docker image builds successfully and all tools are available

## 9. Makefile Updates

- [ ] 9.1 Add `build-worker` target to build the worker Docker image
- [ ] 9.2 Update `deploy-local` target to build and load the worker image into Minikube
- [ ] 9.3 Add `sync-claude-config` target to create/update the `jarvis-claude-config` ConfigMap from host files
- [ ] 9.4 Update `jarvis-ui` target to include `jaw.jarvis.io` in the hosts instructions output

## 10. Gateway Routing

- [ ] 10.1 Verify `jaw.jarvis.io` is already covered by the `*.jarvis.io` wildcard on the Istio gateway (no gateway changes needed)
- [ ] 10.2 Implement dynamic HTTPRoute creation in the K8s service (`backend/app/services/k8s.py`): match `jaw.jarvis.io` + path prefix `/<worker_id>/`, route to `jarvis-worker-<worker_id>:3000`, strip prefix
- [ ] 10.3 Test HTTPRoute creation and deletion for a worker lifecycle

## 11. Frontend API Client

- [ ] 11.1 Add `WorkerState`, `WorkerType`, `Worker`, `WorkerSummary`, `Repository` TypeScript types to `frontend/src/api/client.ts`
- [ ] 11.2 Add worker API functions: `createWorker`, `listWorkers`, `getWorker`, `updateWorker`, `deleteWorker`
- [ ] 11.3 Add repository API functions: `createRepository`, `listRepositories`, `getRepository`, `deleteRepository`
- [ ] 11.4 Update `Task` interface to include `worker: WorkerSummary | null`

## 12. Frontend Workers Page

- [ ] 12.1 Create `frontend/src/pages/Workers/Workers.tsx` with page layout (repository panel + worker card grid)
- [ ] 12.2 Create `frontend/src/pages/Workers/Workers.css` with styles following JADS design system
- [ ] 12.3 Implement repository management panel: add form (git URL + branch), list with delete buttons, error handling for duplicates and in-use repos
- [ ] 12.4 Implement worker card grid: responsive layout, card rendering with ID, task title, type badge, state indicator (color-coded), creation timestamp
- [ ] 12.5 Implement worker card click: open `jaw.jarvis.io/<worker_id>` in new tab
- [ ] 12.6 Implement worker creation form: task dropdown (filtered to tasks without workers), repository multi-select, type selector, create button
- [ ] 12.7 Implement worker deletion from card with confirmation dialog
- [ ] 12.8 Add `/workers` route to `frontend/src/App.tsx` and "Workers" link to the navigation header

## 13. Frontend Task-Worker Integration

- [ ] 13.1 Update `TaskCard` component (in JADS or TaskBoard) to display worker status indicator icon with color coding when a worker exists
- [ ] 13.2 Add play button to `TaskCard` for tasks without workers
- [ ] 13.3 Implement play button click: open worker creation dialog pre-filled with the task, repository multi-select, create button
- [ ] 13.4 Implement worker status indicator click: open `jaw.jarvis.io/<worker_id>` in new tab
- [ ] 13.5 Add VSCode icon button to `TaskCard` for tasks with active (non-archived) workers
- [ ] 13.6 Implement VSCode icon click: open `vscode://` URI targeting the worker pod in `jarvis` namespace

## 14. MCP Server Tools

- [ ] 14.1 Create `artifacts/servers/jarvis/src/tools/workers.py` with tools: `create_worker`, `list_workers`, `get_worker`, `update_worker`, `delete_worker`
- [ ] 14.2 Create `artifacts/servers/jarvis/src/tools/repositories.py` with tools: `create_repository`, `list_repositories`, `delete_repository`
- [ ] 14.3 Write tests for the new MCP tools

## 15. Documentation & CI

- [ ] 15.1 Update `CLAUDE.md` repository structure section to include `worker/` directory and new Helm templates
- [ ] 15.2 Update `.github/workflows/docker-publish.yml` to build and push the worker Docker image to GHCR
- [ ] 15.3 Add `jaw.jarvis.io` to the known limitations table and routing documentation in `CLAUDE.md`
