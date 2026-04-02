# Spec: backend-api

## Purpose

Defines the requirements for the Python/FastAPI backend application, including its HTTP endpoints, database layer, and Docker packaging.

## Requirements

### Requirement: Python backend application skeleton
The system SHALL provide a Python backend application in the `backend/` directory, using FastAPI as the web framework, Pydantic 2 as the data modeling layer, SQLAlchemy 2 with SQLite as the data layer, and `uv` as the package manager. The application SHALL mount task management routers under the `/api/v1/` prefix.

#### Scenario: Application starts successfully
- **WHEN** the backend container starts
- **THEN** the FastAPI application is reachable on port 8000 and the root endpoint `GET /` returns HTTP 200

#### Scenario: OpenAPI documentation available
- **WHEN** a browser navigates to `GET /docs`
- **THEN** the Swagger UI is rendered with all available API routes listed, including versioned task management endpoints

#### Scenario: Task management routes mounted
- **WHEN** the application starts
- **THEN** routes under `/api/v1/tasks`, `/api/v1/dailies`, and `/api/v1/weeklies` are registered and visible in OpenAPI docs

### Requirement: Health check endpoint
The backend SHALL expose a health check endpoint for Kubernetes liveness and readiness probes.

#### Scenario: Health check returns healthy status
- **WHEN** `GET /health` is requested
- **THEN** the response is HTTP 200 with JSON body `{"status": "ok"}`

### Requirement: SQLite database persistence
The backend SHALL use SQLite as its database, with the database file path configurable via the `DATABASE_URL` environment variable.

#### Scenario: Database file created on startup
- **WHEN** the backend starts and `DATABASE_URL` points to a writable path
- **THEN** the SQLite database file is created at the specified path if it does not exist

#### Scenario: Database path from environment
- **WHEN** the `DATABASE_URL` environment variable is set to `sqlite:////data/jarvis.db`
- **THEN** the backend stores all data at `/data/jarvis.db`

### Requirement: uv as package manager
The backend SHALL use `uv` as its Python package manager. Dependencies SHALL be declared in `pyproject.toml` (no `[build-system]` section). A `uv.lock` lockfile SHALL ensure reproducible installs. Dev dependencies SHALL use `[dependency-groups].dev`.

#### Scenario: Dependencies installed via uv
- **WHEN** `uv sync` is executed in the `backend/` directory
- **THEN** all dependencies are installed into a `.venv` virtual environment

#### Scenario: Lockfile ensures reproducibility
- **WHEN** `uv sync --frozen` is executed
- **THEN** the exact versions from `uv.lock` are installed without resolving

### Requirement: Backend Docker image
The backend SHALL be packaged as a Docker image built from `backend/Dockerfile`, using `uv sync --frozen` for dependency installation.

#### Scenario: Image builds successfully
- **WHEN** `docker build -t jarvis-backend ./backend` is executed
- **THEN** the build completes without error and produces a runnable image

#### Scenario: Container runs without root privileges
- **WHEN** the Docker container is started
- **THEN** the process runs as a non-root user (UID ≥ 1000)

### Requirement: API versioning
The backend SHALL support API versioning via URL prefix. All new task management endpoints SHALL be mounted under `/api/v1/`. The root (`/`) and health (`/health`) endpoints SHALL remain unversioned.

#### Scenario: Versioned endpoint accessible
- **WHEN** `GET /api/v1/tasks` is called
- **THEN** the tasks endpoint responds with HTTP 200

#### Scenario: Unversioned root still works
- **WHEN** `GET /` is called
- **THEN** the root endpoint responds with HTTP 200 as before

### Requirement: Database session middleware via dependency injection
The backend SHALL provide a `get_db` FastAPI dependency that yields a SQLAlchemy `Session`. Route handlers that need database access SHALL declare this dependency.

#### Scenario: Route handler receives session
- **WHEN** a route handler with `Depends(get_db)` is invoked
- **THEN** a valid SQLAlchemy session is provided

### Requirement: Pydantic as core dependency
Pydantic 2.12.5 SHALL be added to `pyproject.toml` as a core dependency. All structured data in the backend SHALL use Pydantic `BaseModel` classes.

#### Scenario: Pydantic available in backend
- **WHEN** `uv run python -c "import pydantic"` is executed
- **THEN** `pydantic` version 2.12.5 is available

### Requirement: Auto-migration on startup
The backend SHALL run `alembic upgrade head` automatically during the FastAPI lifespan startup, ensuring all database tables exist before handling requests.

#### Scenario: Tables created on first start
- **WHEN** the backend starts against an empty database
- **THEN** Alembic migrations run and all tables are created before the first request is served
