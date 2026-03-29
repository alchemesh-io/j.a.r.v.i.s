## ADDED Requirements

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

### Requirement: uv as package manager
The backend SHALL use `uv` as its Python package manager. Dependencies SHALL be declared in `pyproject.toml` (no `[build-system]` section). A `uv.lock` lockfile SHALL ensure reproducible installs. Dev dependencies SHALL use `[dependency-groups].dev`.

#### Scenario: Dependencies installed via uv
- **WHEN** `uv sync` is executed in the `backend/` directory
- **THEN** all dependencies are installed into a `.venv` virtual environment

#### Scenario: Lockfile ensures reproducibility
- **WHEN** `uv sync --frozen` is executed
- **THEN** the exact versions from `uv.lock` are installed without resolving

### Requirement: Pydantic as core dependency
Pydantic 2.12.5 SHALL be added to `pyproject.toml` as a core dependency. All structured data in the backend SHALL use Pydantic `BaseModel` classes.

#### Scenario: Pydantic available in backend
- **WHEN** `uv run python -c "import pydantic"` is executed
- **THEN** `pydantic` version 2.12.5 is available

## MODIFIED Requirements

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
