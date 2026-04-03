## 1. Backend — Database Integration (Chunk 1)

- [x] 1.1 Add `pydantic==2.12.5`, `alembic` to `pyproject.toml` dependencies, configure `uv` as package manager with `uv.lock`
- [x] 1.2 Create `app/db/engine.py` — SQLAlchemy 2 engine factory with `DATABASE_URL` env var, WAL mode pragma for SQLite
- [x] 1.3 Create `app/db/session.py` — `SessionLocal` factory and `get_db()` FastAPI dependency (yield-based, auto-commit/rollback)
- [x] 1.4 Create `app/db/base.py` — declarative `Base` class for ORM models
- [x] 1.5 Initialize Alembic (`alembic init`) with `env.py` configured to import `Base.metadata`
- [x] 1.6 Update `app/main.py` — remove inline engine creation, wire up session dependency, keep `/` and `/health` unversioned
- [x] 1.7 Verify: backend starts, connects to SQLite, `GET /` and `GET /health` still work

## 2. Backend — ORM Models & Pydantic Schemas (Chunk 2)

- [x] 2.1 Create `app/models/enums.py` — `TaskType` (refinement, implementation, review) and `TaskStatus` (created, done) as `(str, Enum)`
- [x] 2.2 Create `app/models/weekly.py` — `Weekly` ORM model (id, week_start, dailies relationship)
- [x] 2.3 Create `app/models/daily.py` — `Daily` ORM model (id, date, weekly_id FK cascade, weekly + tasks relationships)
- [x] 2.4 Create `app/models/task.py` — `Task` ORM model (id, jira_ticket_id, title, type, status, daily_entries relationship)
- [x] 2.5 Create `app/models/daily_task.py` — `DailyTask` association model (daily_id FK, task_id FK, priority, unique constraint on daily_id+priority)
- [x] 2.6 Create `app/models/__init__.py` — re-export all models for Alembic metadata discovery
- [x] 2.7 Create `app/schemas/task.py` — Pydantic request/response models for Task (Create, Update, Response)
- [x] 2.8 Create `app/schemas/daily.py` — Pydantic models for Daily (Create, Response with nested tasks)
- [x] 2.9 Create `app/schemas/weekly.py` — Pydantic models for Weekly (Create, Response with nested dailies)
- [x] 2.10 Create `app/schemas/daily_task.py` — Pydantic models for DailyTask association (Create, Reorder batch)
- [x] 2.11 Generate initial Alembic migration (`alembic revision --autogenerate`) and verify `alembic upgrade head` creates all tables
- [x] 2.12 Write backend tests for models — create, cascade delete, unique constraints, enum validation

## 3. Backend — REST API Endpoints (Chunk 2 continued)

- [x] 3.1 Create `app/routes/tasks.py` — CRUD endpoints under `/api/v1/tasks` (POST, GET list, GET by id, PATCH, DELETE) with date/scope filtering
- [x] 3.2 Create `app/routes/weeklies.py` — CRUD endpoints under `/api/v1/weeklies` (POST, GET list, GET by id with nested dailies)
- [x] 3.3 Create `app/routes/dailies.py` — CRUD endpoints under `/api/v1/dailies` (POST, GET by id, GET by date query param)
- [x] 3.4 Create `app/routes/daily_tasks.py` — association endpoints under `/api/v1/dailies/{daily_id}/tasks` (POST add, DELETE remove, PUT reorder batch)
- [x] 3.5 Mount all routers in `app/main.py` under the `/api/v1` prefix
- [x] 3.6 Create `app/config.py` — Pydantic `BaseSettings` for app configuration from env vars
- [x] 3.7 Write backend tests for all API endpoints — happy path + error cases (404, 422, unique violations)
- [x] 3.8 Verify OpenAPI docs at `/docs` show all versioned endpoints

## 4. Frontend — Design System Setup (Chunk 3)

- [x] 4.1 Convert `frontend/` to npm workspaces — add `packages/jads/` with its own `package.json` (`@jarvis/jads`)
- [x] 4.2 Update root `package.json` with workspaces config, update Vite config for workspace resolution
- [x] 4.3 Set up Storybook 10.3 in `packages/jads/` with Vite builder
- [x] 4.4 Set up Vitest 4.1.2 in `packages/jads/` with React Testing Library
- [x] 4.5 Define J.A.D.S CSS custom properties (dark futuristic theme — colors, spacing, typography, glowing accents)
- [x] 4.6 Create base J.A.D.S components: Button, Card, Input, Select/Dropdown, IconButton — with stories and tests
- [x] 4.7 Create J.A.D.S TaskCard component — type color coding, JIRA icon link, dimmed state for done, with story and tests
- [x] 4.8 Create J.A.D.S Calendar component — month-view grid, month/year navigation, date selection, with story and tests
- [x] 4.9 Verify WCAG compliance: keyboard navigation, focus indicators, color contrast (AA minimum)

## 5. Frontend — Playwright E2E Setup (Chunk 3)

- [x] 5.1 Install Playwright and create config at `frontend/e2e/playwright.config.ts`
- [x] 5.2 Create a smoke E2E test — app loads, header visible, navigation works
- [x] 5.3 Add Makefile target and npm script for running E2E tests locally

## 6. Frontend — Task Board UI (Chunk 4 & 5)

- [x] 6.1 Install `react-router` v7, `@tanstack/react-query`, `@dnd-kit/core`, `@dnd-kit/sortable`
- [x] 6.2 Set up React Router in `App.tsx` — routes: `/` (dashboard), `/tasks` (task board)
- [x] 6.3 Set up TanStack Query provider in app root
- [x] 6.4 Create API client module — typed fetch functions for all `/api/v1/` endpoints
- [x] 6.5 Build TaskBoard page layout — left calendar panel, right task list with scope dropdown
- [x] 6.6 Implement calendar navigation — integrate J.A.D.S Calendar, wire selected date to task query
- [x] 6.7 Implement scope dropdown (daily/weekly/all) — wire to task query params
- [x] 6.8 Implement task list grouped by type (refinement, implementation, review) ordered by priority
- [x] 6.9 Implement drag-and-drop reordering with @dnd-kit — placeholder animation, batch priority API call on drop
- [x] 6.10 Implement task creation form — JIRA ticket ID extraction, title, type, multi-date selection
- [x] 6.11 Implement task editing — inline or modal edit, "Add to today's planning" shortcut
- [x] 6.12 Implement task deletion with confirmation
- [x] 6.13 Write Playwright E2E test for task board — create task, reorder, filter, delete

## 7. Frontend — J.A.R.V.I.S Dashboard (Chunk 6)

- [x] 7.1 Build Dashboard page layout — header, three metric blocks area, brain animation, chat input
- [x] 7.2 Implement Workers block (mocked data) — four color-coded indicators (idle, working, attention, done)
- [x] 7.3 Implement Daily Tasks block — fetch today's task metrics, display color-coded counts (blue/orange/red/black)
- [x] 7.4 Implement Weekly Tasks block — fetch current week metrics, same color scheme as daily
- [x] 7.5 Implement brain animation — CSS/canvas holographic circuit animation inspired by J.A.R.V.I.S wallpaper
- [x] 7.6 Implement block drag-and-drop layout reordering with @dnd-kit, persist order to localStorage
- [x] 7.7 Implement compact mode toggle — icons-only titles, hidden metric text labels
- [x] 7.8 Implement chat/prompt input placeholder (non-functional)
- [x] 7.9 Write Playwright E2E test for dashboard — block reorder, compact mode toggle, metrics display

## 8. MCP Server (Chunk 7)

- [x] 8.1 Create `mcp_server/` directory with `pyproject.toml` — depends on `mcp` SDK and `httpx` (no SQLAlchemy, no shared models)
- [x] 8.2 Create `mcp_server/api_client.py` — typed httpx client for backend `/api/v1/` endpoints, configured via `BACKEND_URL` env var
- [x] 8.3 Implement MCP tool: `create_task`, `list_tasks`, `update_task`, `delete_task` — delegating to backend API via httpx client
- [x] 8.4 Implement MCP tool: `create_daily`, `add_task_to_daily`, `remove_task_from_daily`, `list_daily_tasks` — delegating to backend API
- [x] 8.5 Implement MCP tool: `list_weekly_tasks` — delegating to backend API
- [x] 8.6 Create `mcp_server/Dockerfile`
- [x] 8.7 Write tests for MCP tools — mock backend API responses, verify tool input/output
- [x] 8.8 Verify MCP server starts and advertises all tools

## 9. Infrastructure — Helm & Deployment (Chunk 1 & 7)

- [x] 9.1 Add `backend-configmap.yaml` Helm template — `DATABASE_URL` and app config env vars
- [x] 9.2 Add `backend-secret.yaml` Helm template — placeholder for sensitive config
- [x] 9.3 Update `backend-deployment.yaml` — mount ConfigMap and Secret as env vars
- [x] 9.4 Add `mcp-deployment.yaml` and `mcp-service.yaml` Helm templates — standalone MCP pod with `BACKEND_URL` env var, no PVC mount
- [x] 9.5 Update `values.yaml` — add MCP server image config, `BACKEND_URL`, ConfigMap/Secret values
- [x] 9.7 Update `frontend/Dockerfile` for npm workspaces build (J.A.D.S package)
- [x] 9.8 Verify `make deploy-local` builds and deploys all three services successfully

## 10. CLAUDE.md Update (Chunk 8)

- [x] 10.1 Update CLAUDE.md — add backend package structure documentation (models, schemas, routes, db, config)
- [x] 10.2 Update CLAUDE.md — add frontend workspace structure (J.A.D.S, Storybook, Playwright)
- [x] 10.3 Update CLAUDE.md — add MCP server section
- [x] 10.4 Update CLAUDE.md — add new dependencies and version pins (Pydantic 2.12.5, Vitest 4.1.2, Storybook 10.3)
- [x] 10.5 Update CLAUDE.md — add API versioning convention (`/api/v1/`)
