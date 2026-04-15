## ADDED Requirements

### Requirement: WorkerState enum
The system SHALL define a `WorkerState` string enum with values: `initialized`, `working`, `waiting_for_human`, `done`, `archived`.

#### Scenario: Valid worker state accepted
- **WHEN** a worker is created with state `initialized`
- **THEN** the worker is persisted with `state = "initialized"`

#### Scenario: Invalid worker state rejected
- **WHEN** a worker update is attempted with state `invalid_state`
- **THEN** the API returns HTTP 422 with a validation error

### Requirement: WorkerType enum
The system SHALL define a `WorkerType` string enum with values: `claude_code`. This enum is reserved for future extension (e.g., `github_copilot`).

#### Scenario: Valid worker type accepted
- **WHEN** a worker is created with type `claude_code`
- **THEN** the worker is persisted with `type = "claude_code"`

#### Scenario: Invalid worker type rejected
- **WHEN** a worker is created with type `vscode_agent`
- **THEN** the API returns HTTP 422 with a validation error

### Requirement: Worker ORM model
The system SHALL define a `Worker` SQLAlchemy model with columns: `id` (String(32), primary key, generated as UUID v4 hex without hyphens), `task_id` (integer, foreign key to `task.id`, not nullable, unique), `type` (Enum(WorkerType), not nullable, default `claude_code`), `state` (Enum(WorkerState), not nullable, default `initialized`), `created_at` (DateTime, not nullable, server default UTC now), `updated_at` (DateTime, not nullable, server default UTC now, on update UTC now). It SHALL have relationships: `task` navigating to `Task`, `repositories` navigating to `Repository` via the `worker_repository` join table.

#### Scenario: Worker created with generated ID
- **WHEN** a worker is created for task ID 42
- **THEN** a row is inserted with a 32-character hex ID, `task_id = 42`, `state = "initialized"`, `type = "claude_code"`

#### Scenario: One worker per task enforced
- **WHEN** a worker is created for a task that already has a worker
- **THEN** the database raises a unique constraint violation on `task_id`

#### Scenario: Worker references multiple repositories
- **WHEN** a worker is created with 3 repository associations
- **THEN** 3 rows are inserted in the `worker_repository` join table

### Requirement: Repository ORM model
The system SHALL define a `Repository` SQLAlchemy model with columns: `id` (integer, primary key, auto-increment), `git_url` (Text, not nullable), `branch` (String(255), not nullable, default `"main"`). The combination `(git_url, branch)` SHALL have a unique constraint.

#### Scenario: Repository created with default branch
- **WHEN** a repository is created with `git_url = "https://github.com/org/repo"` and no branch specified
- **THEN** the repository is persisted with `branch = "main"`

#### Scenario: Repository created with custom branch
- **WHEN** a repository is created with `git_url = "https://github.com/org/repo"` and `branch = "develop"`
- **THEN** the repository is persisted with `branch = "develop"`

#### Scenario: Duplicate git_url + branch rejected
- **WHEN** a repository is created with a `(git_url, branch)` pair that already exists
- **THEN** the database raises a unique constraint violation

#### Scenario: Same URL with different branches allowed
- **WHEN** two repositories are created for the same `git_url` but branches `"main"` and `"develop"`
- **THEN** both rows are persisted successfully

### Requirement: WorkerRepository association model
The system SHALL define a `WorkerRepository` SQLAlchemy association table with columns: `worker_id` (String(32), foreign key to `worker.id`, on delete cascade), `repository_id` (integer, foreign key to `repository.id`, on delete cascade). The combination `(worker_id, repository_id)` SHALL be the composite primary key.

#### Scenario: Repository linked to worker
- **WHEN** a repository is associated with a worker
- **THEN** a row is inserted in `worker_repository` with the correct foreign keys

#### Scenario: Worker deletion cascades to associations
- **WHEN** a worker is deleted
- **THEN** all rows in `worker_repository` referencing that worker are cascade-deleted

#### Scenario: Repository deletion cascades to associations
- **WHEN** a repository is deleted
- **THEN** all rows in `worker_repository` referencing that repository are cascade-deleted

### Requirement: CRUD endpoints for Workers
The API SHALL expose RESTful endpoints for worker management under `/api/v1/workers`.

#### Scenario: Create a worker
- **WHEN** `POST /api/v1/workers` is called with `{ "task_id": 42, "repository_ids": [1, 2], "type": "claude_code" }`
- **THEN** the worker is created with a generated ID, associated with the specified repositories, and returned with HTTP 201

#### Scenario: Create a worker for a task that already has one
- **WHEN** `POST /api/v1/workers` is called with a `task_id` that already has a worker
- **THEN** HTTP 409 is returned with an error message

#### Scenario: List all workers
- **WHEN** `GET /api/v1/workers` is called
- **THEN** all workers are returned with their task and repository associations as a JSON array with HTTP 200

#### Scenario: Get a worker by ID
- **WHEN** `GET /api/v1/workers/{id}` is called with a valid worker ID
- **THEN** the worker is returned with effective state (merged DB + pod live state) with HTTP 200

#### Scenario: Get a non-existent worker
- **WHEN** `GET /api/v1/workers/{id}` is called with an ID that does not exist
- **THEN** HTTP 404 is returned

#### Scenario: Update a worker state
- **WHEN** `PATCH /api/v1/workers/{id}` is called with `{ "state": "done" }`
- **THEN** the worker state is updated and the worker is returned with HTTP 200

#### Scenario: Delete a worker
- **WHEN** `DELETE /api/v1/workers/{id}` is called with a valid worker ID
- **THEN** the worker's Kubernetes resources (pod, service, httproute) are deleted, the worker record is removed, and HTTP 204 is returned

#### Scenario: Archive a worker
- **WHEN** `PATCH /api/v1/workers/{id}` is called with `{ "state": "archived" }`
- **THEN** the worker's Kubernetes resources are deleted and the worker state is set to `archived`

### Requirement: CRUD endpoints for Repositories
The API SHALL expose RESTful endpoints for repository management under `/api/v1/repositories`.

#### Scenario: Create a repository
- **WHEN** `POST /api/v1/repositories` is called with `{ "git_url": "https://github.com/org/repo", "branch": "main" }`
- **THEN** the repository is created and returned with HTTP 201

#### Scenario: Create a duplicate repository
- **WHEN** `POST /api/v1/repositories` is called with a `(git_url, branch)` pair that already exists
- **THEN** HTTP 409 is returned with an error message

#### Scenario: List all repositories
- **WHEN** `GET /api/v1/repositories` is called
- **THEN** all repositories are returned as a JSON array with HTTP 200

#### Scenario: Get a repository by ID
- **WHEN** `GET /api/v1/repositories/{id}` is called with a valid ID
- **THEN** the repository is returned with HTTP 200

#### Scenario: Delete a repository
- **WHEN** `DELETE /api/v1/repositories/{id}` is called with a valid ID
- **THEN** the repository is removed and HTTP 204 is returned

#### Scenario: Delete a repository in use by a worker
- **WHEN** `DELETE /api/v1/repositories/{id}` is called for a repository associated with an active worker
- **THEN** HTTP 409 is returned with an error explaining the repository is in use

### Requirement: Worker effective state merges DB and pod status
The `GET /api/v1/workers/{id}` response SHALL include an `effective_state` field that combines the database state with the live pod status endpoint when the pod exists.

#### Scenario: Worker with running pod actively processing
- **WHEN** a worker has DB state `initialized` and the pod status endpoint reports `working`
- **THEN** the response includes `"effective_state": "working"`

#### Scenario: Worker with running pod waiting for input
- **WHEN** a worker has DB state `initialized` and the pod status endpoint reports `waiting_for_human`
- **THEN** the response includes `"effective_state": "waiting_for_human"`

#### Scenario: Worker with no reachable pod
- **WHEN** a worker has DB state `initialized` but the pod is not reachable
- **THEN** the response includes `"effective_state": "initialized"` and a `"pod_status": "unreachable"` field

#### Scenario: Archived worker
- **WHEN** a worker has DB state `archived`
- **THEN** the response includes `"effective_state": "archived"` without querying the pod

## Implementation Additions

### Requirement: RepositoryResponse includes worker counts
The `RepositoryResponse` Pydantic schema SHALL include `worker_count` (total number of workers using this repository) and `active_worker_count` (number of non-archived workers using this repository) fields. Repository routes SHALL use `selectinload(Repository.workers)` for eager loading to compute these counts efficiently.

#### Scenario: Repository with workers returns counts
- **WHEN** `GET /api/v1/repositories/{id}` is called for a repository used by 3 workers (2 active, 1 archived)
- **THEN** the response includes `"worker_count": 3` and `"active_worker_count": 2`

#### Scenario: Repository with no workers returns zero counts
- **WHEN** `GET /api/v1/repositories/{id}` is called for a repository with no workers
- **THEN** the response includes `"worker_count": 0` and `"active_worker_count": 0`

### Requirement: Dedicated jarvis-jaw-secret for worker credentials
Worker pods SHALL source credentials from a dedicated Kubernetes Secret named `jarvis-jaw-secret` containing keys: `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, and `GITHUB_TOKEN`. This Secret SHALL be separate from the backend secret (`jarvis-backend-secret`). The Secret template SHALL be documented in `secrets/jaw-secret.example.yaml` and the actual file (`secrets/jaw-secret.yaml`) SHALL be gitignored.

#### Scenario: Worker pod mounts jaw-secret
- **WHEN** a worker pod is created by the backend
- **THEN** the pod spec references `jarvis-jaw-secret` for environment variables, not `jarvis-backend-secret`

#### Scenario: JAW secret deployed via Makefile
- **WHEN** `make deploy` or `make deploy-local` is executed
- **THEN** the `_deploy-jaw-secrets` target applies `secrets/jaw-secret.yaml` to the cluster

### Requirement: KUBE_CONTEXT env var for backend
The backend configuration SHALL include a `KUBE_CONTEXT` setting (default `"minikube"`) used to generate VSCode Dev Containers URIs. This value SHALL be configurable via the `backend-configmap.yaml` Helm template.

#### Scenario: KUBE_CONTEXT used in VSCode URI
- **WHEN** the backend generates a VSCode URI with `KUBE_CONTEXT=minikube`
- **THEN** the hex-encoded URI payload includes the `minikube` context string

### Requirement: WORKER_IMAGE and WORKER_IMAGE_PULL_POLICY env vars
The backend configuration SHALL include `WORKER_IMAGE` (the Docker image reference for worker pods) and `WORKER_IMAGE_PULL_POLICY` (the Kubernetes image pull policy, e.g., `Never`, `Always`, `IfNotPresent`) settings. These SHALL be configurable via `backend-configmap.yaml` and used by `k8s.py` when creating worker pods, rather than hardcoding image references.

#### Scenario: Worker pod uses configured image
- **WHEN** a worker pod is created with `WORKER_IMAGE=ghcr.io/org/worker:v1.2.3` and `WORKER_IMAGE_PULL_POLICY=Always`
- **THEN** the pod spec contains `image: ghcr.io/org/worker:v1.2.3` and `imagePullPolicy: Always`

#### Scenario: Default local image
- **WHEN** `WORKER_IMAGE` is set to `jarvis-worker:latest` and `WORKER_IMAGE_PULL_POLICY` is `Never`
- **THEN** the pod uses the locally loaded image without pulling from a registry

### Requirement: httpx as runtime dependency
The `httpx` Python package SHALL be listed as a main (non-dev) dependency in `backend/pyproject.toml` because it is used at runtime by `k8s.py` for HTTP calls to worker status endpoints.

#### Scenario: httpx importable at runtime
- **WHEN** the backend application starts
- **THEN** `import httpx` succeeds without requiring dev dependencies
