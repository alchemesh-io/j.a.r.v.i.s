## Context

J.A.R.V.I.S is a FastAPI + React/Vite application deployed via Helm/ArgoCD on Minikube. The backend currently has a bare SQLAlchemy engine with no models, sessions, or migrations. The frontend is a single-page shell with a header, hero section, and footer — no routing, no state management, no component library. This design introduces the full task management stack across both layers.

Key constraints:
- SQLite as the database (single-writer, acceptable for local dev)
- Python 3.12+, `uv` as package manager, Pydantic 2.12.5 as the universal data layer
- Vite 8.x (pinned), React 19, TypeScript 5.9
- All config via environment variables (12-factor)
- ArgoCD manages deployments — no direct `helm install`

## Goals / Non-Goals

**Goals:**
- Establish the backend's database layer pattern (sessions, models, migrations) reusable for all future features
- Deliver a complete task management API with OpenAPI documentation
- Build J.A.D.S as an independent, testable, Storybook-documented component library
- Implement the task board and dashboard UIs as described in the task specification
- Create an MCP server for agent-driven task operations
- Full test coverage strategy: Vitest for components, Playwright for E2E

**Non-Goals:**
- PostgreSQL migration (future — just keep `DATABASE_URL` configurable)
- User authentication or multi-tenancy
- Real worker agent orchestration (dashboard workers section is mocked)
- Real chat/prompt backend (dashboard chat section is a placeholder)
- Horizontal backend scaling (SQLite limitation)
- SSR or server components

## Decisions

### D1: Backend package structure — flat modules under `app/`

**Choice**: Organize as `app/db/`, `app/models/`, `app/schemas/`, `app/routes/`, `app/config.py`

**Alternatives considered**:
- Domain-driven directories (`app/tasks/`, `app/planning/`) — premature for a single bounded context
- Single `main.py` with everything — doesn't scale past the current skeleton

**Rationale**: Flat-by-layer is the FastAPI convention, easy to navigate, and sufficient until we have multiple bounded contexts. Each layer has a clear responsibility: `models/` = SQLAlchemy ORM, `schemas/` = Pydantic request/response, `routes/` = API endpoints, `db/` = engine + session + migrations.

### D2: Database sessions — FastAPI dependency injection with `yield`

**Choice**: `get_db()` generator dependency that yields a `Session` and commits/rollbacks automatically.

**Alternatives considered**:
- Middleware-based session (adds session to every request, even those that don't need it)
- Manual session in each route (error-prone, repetitive)

**Rationale**: FastAPI's `Depends(get_db)` is idiomatic, only creates sessions for routes that need them, and handles cleanup via the generator lifecycle.

### D3: Migrations — Alembic with auto-generation

**Choice**: Alembic configured with `env.py` pointing at the SQLAlchemy `Base.metadata`. Auto-generate migrations from model changes.

**Rationale**: The project already uses SQLAlchemy. Alembic is the standard migration tool. Auto-generation from model diffs reduces human error. Initial migration creates all tables; future changes generate incremental migrations.

### D4: Pydantic as universal data contract

**Choice**: Every API request body, response body, and config object is a Pydantic `BaseModel`. No raw dicts anywhere in the codebase.

**Rationale**: Explicit requirement from the task spec. Pydantic 2 has native SQLAlchemy integration via `model_validate`, good FastAPI integration, and enforces type safety at runtime.

### D5: Enum types — Python `str, Enum` not stored in database

**Choice**: `TaskType` and `TaskStatus` are Python `(str, Enum)` classes. Stored as strings in SQLite via SQLAlchemy's `Enum` type (which stores the value as text). Not backed by a database lookup table.

**Rationale**: Task spec explicitly states "not in database". String enums serialize cleanly to JSON and are easy to validate via Pydantic.

### D5b: Backend package manager — uv

**Choice**: Use `uv` as the Python package manager. `pyproject.toml` with no `[build-system]` section (uv-native), `uv.lock` for reproducible installs, `[dependency-groups].dev` for dev dependencies. Dockerfile uses `COPY --from=ghcr.io/astral-sh/uv:latest` and `uv sync --frozen`.

**Alternatives considered**:
- pip + hatchling — slower installs, no lockfile by default, requires `[build-system]` boilerplate
- poetry — heavier tooling, separate `poetry.lock` format, less Docker-friendly

**Rationale**: `uv` is significantly faster than pip, produces a deterministic lockfile, handles virtual environment creation automatically, and has first-class Docker support via the official `ghcr.io/astral-sh/uv` image. The `uv run` command makes running scripts in the project venv seamless. All commands: `uv sync` (install), `uv run pytest` (run tests), `uv lock` (update lockfile).

### D6: Frontend architecture — monorepo with workspace packages

**Choice**: Use npm workspaces. Structure:
```
frontend/
├── packages/
│   └── jads/          # J.A.D.S design system (library)
│       ├── src/
│       ├── package.json
│       └── .storybook/
├── src/               # Main app
├── e2e/               # Playwright tests
└── package.json       # Workspace root
```

**Alternatives considered**:
- Separate repository for J.A.D.S — too heavy for a single-developer project
- No package separation — can't independently test/document the design system
- Turborepo/Nx — overkill, npm workspaces suffice

**Rationale**: npm workspaces allow J.A.D.S to be a real package (`@jarvis/jads`) imported by the app, with its own Storybook and Vitest config, while living in the same repo. Minimal tooling overhead.

### D7: Frontend routing — React Router v7

**Choice**: Client-side routing with React Router. Routes: `/` (dashboard), `/tasks` (task board).

**Rationale**: The app needs at least two views. React Router is the standard. No SSR needed.

### D8: Drag-and-drop — @dnd-kit

**Choice**: `@dnd-kit/core` + `@dnd-kit/sortable` for task reordering.

**Alternatives considered**:
- `react-beautiful-dnd` — archived, no longer maintained
- `react-dnd` — lower-level, more boilerplate
- Native HTML5 drag — poor mobile support, no animations

**Rationale**: `@dnd-kit` is actively maintained, supports keyboard accessibility (WCAG), has built-in animations, and handles sortable lists natively.

### D9: State management — React Query (TanStack Query) for server state

**Choice**: TanStack Query for all API data fetching, caching, and mutations. Local UI state via React `useState`/`useReducer`.

**Alternatives considered**:
- Redux/Zustand — adds complexity for what is primarily server-state
- Plain `fetch` + `useEffect` — no caching, no optimistic updates, no retry

**Rationale**: Task data is server-owned. TanStack Query provides caching, background refetch, optimistic updates for drag-and-drop reorder, and mutation invalidation — all critical for the task board UX.

### D10: Dashboard layout persistence — localStorage

**Choice**: Store the user's block layout order in `localStorage`.

**Alternatives considered**:
- Backend user preferences table — requires auth, overkill for single-user
- Cookie — size limits, not semantic

**Rationale**: Single-user app, no auth. `localStorage` persists across sessions and is trivial to implement. If auth is added later, migrate to a backend preference store.

### D11: MCP server — standalone Python process using the MCP SDK, API client to backend

**Choice**: Separate Python entry point (`mcp_server/`) using the official `mcp` Python SDK, communicating with the backend exclusively via its REST API (`/api/v1/`). No direct database access.

**Alternatives considered**:
- Direct SQLite access from MCP server — creates concurrent write contention on SQLite, couples MCP to the database layer, duplicates ORM/session logic
- Embed MCP in the FastAPI process — conflates HTTP API with MCP protocol
- HTTP-only API for agents — loses MCP tool discovery and structured protocol

**Rationale**: MCP is the standard for agent tool integration. Using the backend REST API as the data layer keeps the MCP server stateless and decoupled — it only needs `httpx` and the backend URL. This eliminates SQLite concurrent access issues, avoids duplicating models/sessions, and means the MCP server works unchanged when the backend migrates to PostgreSQL. The backend URL is configured via a `BACKEND_URL` environment variable.

### D12: Calendar component — custom implementation in J.A.D.S

**Choice**: Build a month-view calendar component as part of J.A.D.S rather than using a third-party library.

**Rationale**: The calendar is a core navigation element inspired by Google Calendar's mini-calendar. It needs to integrate tightly with the design system's theming (dark futuristic look). Third-party calendar components bring heavy styling baggage. A month-view grid is straightforward to implement and fully testable.

## Risks / Trade-offs

**[MCP server depends on backend availability]** → The MCP server calls the backend REST API, so it cannot function if the backend is down. → *Mitigation*: Use `httpx` with retry logic and timeout configuration. Kubernetes readiness probes on the MCP server can check backend connectivity. This is an acceptable trade-off: the MCP server is a thin API client, and backend availability is already required for the frontend.

**[J.A.D.S as internal package adds build complexity]** → npm workspaces require careful dependency hoisting and Vite alias config. → *Mitigation*: Keep J.A.D.S as a simple TypeScript package with no bundling step of its own — Vite resolves it via workspace links. Storybook uses its own Vite config.

**[Drag-and-drop priority reordering is an optimistic mutation]** → Network lag or failures could desync displayed order vs. server state. → *Mitigation*: TanStack Query's optimistic update with rollback on error. The API accepts a batch priority update endpoint to avoid N+1 requests.

**[Storybook 10.3 + Vite 8 compatibility]** → Storybook versions sometimes lag behind Vite major versions. → *Mitigation*: Pin Storybook to 10.3 as required. If compatibility issues arise, use Storybook's Vite builder with explicit version overrides.

**[Playwright E2E tests need a running backend]** → E2E tests require both frontend and backend to be up. → *Mitigation*: Use a `docker compose` or Makefile target to spin up both services for E2E. Alternatively, mock the API at the network level for frontend-only E2E.

## Migration Plan

No production data exists — this is greenfield. Deployment steps:

1. Backend: Add deps to `pyproject.toml`, run `uv lock` to generate lockfile. Run Alembic initial migration to create all tables. Update Dockerfile to use `uv sync --frozen`.
2. Frontend: Set up npm workspaces, add J.A.D.S package, install new deps. Update Dockerfile for workspace build.
3. Helm: Add ConfigMap for `DATABASE_URL` and any new env vars. No schema changes to existing templates needed — just new env entries on the backend deployment.
4. MCP: New Dockerfile + Helm template for the MCP server as a standalone pod. Only needs `BACKEND_URL` env var — no PVC mount required.
5. Rollback: Since there's no existing data, rollback is simply reverting the deployment to the previous image tags.

## Resolved Questions

- **MCP server deployment model**: Standalone pod. Cleaner separation of concerns, gets its own Helm template and Dockerfile.
- **Playwright CI integration**: Local only for now. No GitHub Actions changes in this iteration.
- **Dashboard block drag-and-drop**: Yes — use `@dnd-kit` for dashboard block layout reordering, consistent with the task board's drag-and-drop approach.
