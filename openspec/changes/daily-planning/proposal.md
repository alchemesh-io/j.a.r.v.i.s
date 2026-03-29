## Why

J.A.R.V.I.S needs its first core feature: task management with daily/weekly planning. As a personal assistant, organizing work through a structured backlog, daily plannings, and weekly views is the foundational capability everything else builds on. This unblocks the assistant's primary value proposition — helping the user stay on top of their work.

## What Changes

- Add SQLAlchemy 2 database integration with proper session management and Alembic migrations
- Introduce Pydantic 2 as the universal data modeling layer (no raw dicts — all structured classes)
- Create domain models: Task, Daily, Weekly, DailyTask (association with priority)
- Create REST API endpoints for full CRUD on tasks, dailies, weeklies, and planning operations
- Build a reusable frontend design system ("J.A.D.S" — Just A Design System) packaged as an internal library, documented with Storybook 10.3
- Implement a task board UI with calendar navigation, drag-and-drop reordering, filtering (daily/weekly/all), and grouping by task type
- Implement a J.A.R.V.I.S dashboard with worker metrics, daily/weekly task summaries, and a chat prompt placeholder
- Add frontend testing with Vitest 4.1.2 (unit) and Playwright (E2E)
- Create an MCP server for agent-driven task and planning management, acting as an API client to the backend
- **BREAKING**: Pydantic becomes a mandatory project-wide requirement — all data structures must use Pydantic classes

## Capabilities

### New Capabilities

- `task-management-api`: Backend REST API for tasks, dailies, weeklies, and daily-task associations, including SQLAlchemy 2 ORM models, Pydantic schemas, and database integration
- `task-board-ui`: Frontend task board with calendar navigation, drag-and-drop, filtering (daily/weekly/all), grouping by type, and task CRUD operations
- `jarvis-dashboard`: Main J.A.R.V.I.S dashboard with worker metrics, daily/weekly task summaries, configurable layout, and chat prompt placeholder
- `design-system`: J.A.D.S (Just A Design System) — packaged component library with Storybook documentation and Vitest test coverage
- `task-mcp-server`: MCP server exposing task and planning operations for agent interaction, communicating with the backend via its REST API

### Modified Capabilities

- `backend-api`: Add database session middleware, Pydantic as core dependency, and new task-related route mounts
- `helm-deployment`: Add ConfigMaps/Secrets for database and app configuration, update backend deployment for new environment variables

## Impact

- **Backend**: `uv` as package manager (replaces pip+hatchling). New Python dependencies (Pydantic 2.12.5, SQLAlchemy 2, Alembic) managed via `pyproject.toml` + `uv.lock`. New packages for models, schemas, routes, and database config. All endpoints auto-documented via FastAPI/OpenAPI.
- **Frontend**: New dependencies (Storybook 10.3, Vitest 4.1.2, Playwright, drag-and-drop library). J.A.D.S packaged as internal library. New pages/components for task board and dashboard.
- **Infrastructure**: Helm values updated with new ConfigMaps/Secrets. SQLite PVC already exists. Backend Dockerfile uses `uv sync` for dependency installation.
- **APIs**: New REST endpoints under `/api/v1/tasks`, `/api/v1/dailies`, `/api/v1/weeklies`. MCP server consumes these endpoints as an API client — no direct database access.
- **Testing**: Full test pyramid — Vitest for J.A.D.S components, Playwright for E2E flows.
