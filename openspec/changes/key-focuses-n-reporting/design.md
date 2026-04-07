## Context

JARVIS currently supports task management with daily/weekly planning. Tasks have types (refinement/implementation/review), statuses (created/done), can be associated with dates, and have markdown notes. The backend uses SQLAlchemy 2 with SQLite, Pydantic 2 schemas, and FastAPI routes. The frontend is React 19 with TanStack Query and a single TaskBoard page. The MCP server wraps the REST API for AI agent access.

This design adds key focuses (strategic goals), task-to-key-focus linking, blockers (impediments), and restructures the frontend to support multiple views (Tasks, Key Focuses, Reports).

## Goals / Non-Goals

**Goals:**
- Introduce key focus entities with kind/status/frequency attributes, linked to the existing weekly time structure
- Enable many-to-many linking between tasks and key focuses
- Introduce blockers as impediments attachable to either a task or a key focus (exclusive)
- Restructure the frontend navigation to support three views under one page shell
- Provide a key focuses card view mirroring the task board UX
- Provide a structured reporting view with previous/current period comparison (daily: tasks, weekly: key focuses)
- Expose all new operations through MCP tools

**Non-Goals:**
- OKR framework integration or complex goal hierarchies
- Quarterly planning UI (quarterly key focuses exist but are managed with the same weekly view calendar)
- Advanced analytics or charting library integration for reports
- PostgreSQL migration (remains SQLite for now)
- Blocker notifications or escalation workflows

## Decisions

### D1: Key Focus model reuses Weekly for time-scoping

**Decision:** `KeyFocus` has a `weekly_id` foreign key linking it to the existing `Weekly` table. Weekly key focuses belong to one week; quarterly key focuses also link to a weekly (the starting week of the quarter).

**Rationale:** Reuses the existing time infrastructure without creating a new `Quarter` table. The weekly table already serves as the time anchor for dailies. Quarterly key focuses simply have `frequency = "quarterly"` and are scoped by their starting week.

**Alternatives considered:**
- Separate `Quarter` model: adds complexity for a single use case, and quarterly boundaries are derivable from the week_start date
- Date range fields on KeyFocus: more flexible but loses the structural link to the weekly/daily hierarchy

### D2: Many-to-many task-key-focus via association table

**Decision:** A `TaskKeyFocus` association table with composite PK `(task_id, key_focus_id)` links tasks to key focuses.

**Rationale:** Simple junction table matches the existing `DailyTask` pattern. No extra data needed on the association (unlike DailyTask which has priority).

### D3: Blocker uses polymorphic reference with exclusive constraint

**Decision:** `Blocker` has nullable `task_id` and `key_focus_id` columns with a CHECK constraint ensuring exactly one is set (XOR). States: `opened`, `resolved`.

**Rationale:** Simpler than generic foreign keys or a separate polymorphic table. The CHECK constraint enforces data integrity at the database level. Two nullable FKs with a CHECK is a well-understood SQLite pattern.

**Alternatives considered:**
- Generic relation (content_type + object_id): loses FK integrity, harder to query
- Separate BlockerTask / BlockerKeyFocus tables: doubles the schema for no benefit

### D4: Frontend navigation via tab-based routing within one page

**Decision:** The TaskBoard page becomes a container with three tab buttons (Tasks, Key Focuses, Reports). Each tab renders its own content area. URL-based routing: `/tasks`, `/key-focuses`, `/reports`.

**Rationale:** Keeps the shared header (calendar, scope selector) while allowing view-specific content. React Router handles the subroutes. Avoids duplicating the calendar/toolbar shell.

### D5: New enum types as Python string enums

**Decision:** Add `KeyFocusKind`, `KeyFocusStatus`, `KeyFocusFrequency`, and `BlockerStatus` to `enums.py`, following the existing pattern of `(str, Enum)`.

**Rationale:** Consistent with existing `TaskType` and `TaskStatus` enums. String enums serialize cleanly to JSON.

### D6: API endpoints follow existing resource nesting pattern

**Decision:**
- `/api/v1/key-focuses` — CRUD for key focuses
- `/api/v1/key-focuses/{id}/tasks` — manage task associations
- `/api/v1/key-focuses/{id}/blockers` — manage blockers on a key focus
- `/api/v1/tasks/{id}/key-focuses` — view/manage key focuses for a task
- `/api/v1/tasks/{id}/blockers` — manage blockers on a task
- `/api/v1/blockers` — list/filter all blockers

**Rationale:** Follows the established nesting pattern (`/dailies/{id}/tasks`, `/tasks/{id}/notes`). Both sides of the many-to-many are queryable.

## Risks / Trade-offs

- **SQLite CHECK constraint for blocker XOR** — SQLite supports CHECK constraints but some ORMs struggle with them. Mitigation: validate at the Pydantic schema level too, so invalid data is caught before hitting the DB.
- **Frontend complexity growth** — Three views in one page shell increases component count. Mitigation: extract shared toolbar/calendar into reusable components; keep view-specific code isolated.
- **Reporting relies on previous period data** — The reports view compares previous vs. current period (previous day's tasks for daily, previous week's key focuses for weekly). Mitigation: API filtering by date/scope already supports fetching both periods; the frontend makes two queries.
- **Quarterly frequency UX** — Quarterly key focuses linked to a single weekly may confuse users about their scope. Mitigation: the UI can display "Q2 2026" label derived from the week_start date; filtering logic handles the quarterly range.

## Migration Plan

1. Add Alembic migration creating `key_focus`, `task_key_focus`, and `blocker` tables
2. Backend: add models, schemas, routes (additive — no breaking changes to existing API)
3. Frontend: restructure TaskBoard into tabbed navigation, add KeyFocus and Report views
4. MCP: add new tool modules for key focuses and blockers
5. Rollback: drop the three new tables via Alembic downgrade; revert frontend to single-view TaskBoard
