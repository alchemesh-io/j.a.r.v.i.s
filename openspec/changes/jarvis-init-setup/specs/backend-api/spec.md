## ADDED Requirements

### Requirement: Python backend application skeleton
The system SHALL provide a Python backend application in the `backend/` directory, using FastAPI as the web framework and SQLAlchemy with SQLite as the data layer.

#### Scenario: Application starts successfully
- **WHEN** the backend container starts
- **THEN** the FastAPI application is reachable on port 8000 and the root endpoint `GET /` returns HTTP 200

#### Scenario: OpenAPI documentation available
- **WHEN** a browser navigates to `GET /docs`
- **THEN** the Swagger UI is rendered with all available API routes listed

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

### Requirement: Backend Docker image
The backend SHALL be packaged as a Docker image built from `backend/Dockerfile`.

#### Scenario: Image builds successfully
- **WHEN** `docker build -t jarvis-backend ./backend` is executed
- **THEN** the build completes without error and produces a runnable image

#### Scenario: Container runs without root privileges
- **WHEN** the Docker container is started
- **THEN** the process runs as a non-root user (UID ≥ 1000)
