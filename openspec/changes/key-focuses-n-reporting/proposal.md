## Why

JARVIS currently supports task management (backlog, daily/weekly planning) but lacks the ability to group work under strategic objectives or track impediments. Adding key focuses gives users a way to define weekly or quarterly goals and link tasks to them, providing visibility into how daily work contributes to larger outcomes. Blockers formalize impediment tracking on tasks and key focuses. A dedicated reporting view will surface progress summaries across these dimensions.

## What Changes

- **New: Key Focus data model and API** -- A new `KeyFocus` entity with title, description, kind (delivery/learning/support/operational/side-quest), status (in-progress/succeed/failed), and frequency (weekly/quarterly). Key focuses are associated with the existing `Weekly` table for time-scoping.
- **New: Task-to-KeyFocus relationship** -- Tasks can reference one or more key focuses via a many-to-many association. The UI shows key focus badges on task cards and provides management controls.
- **New: Blocker data model and API** -- A `Blocker` entity that can be linked to either a task or a key focus (exclusive, not both). States: opened/resolved.
- **New: Navigation and views restructuring** -- The current task board view becomes one of three views (Tasks, Key Focuses, Reports) accessible via a left-side navigation within the same page shell.
- **New: Key Focuses view** -- Card-based rendering similar to the task board, with calendar/frequency selection header, adapted to key focus fields.
- **New: Reports view** -- Structured recap comparing previous period with current: weekly scope shows previous/current week key focuses and remaining blockers; daily scope shows previous/current day tasks and remaining blockers.
- **New: MCP tools for key focuses and blockers** -- Expose all new CRUD operations through the MCP server.

## Capabilities

### New Capabilities
- `key-focus-api`: Backend data model, schemas, and CRUD endpoints for key focuses including the many-to-many relation with tasks
- `blocker-api`: Backend data model, schemas, and CRUD endpoints for blockers (linked to task or key focus)
- `key-focus-ui`: Frontend views for key focus management -- card rendering, creation/editing forms, navigation restructuring with Tasks/Key Focuses/Reports tabs
- `report-ui`: Frontend reporting view with previous/current period comparison (weekly: key focuses + blockers, daily: tasks + blockers)
- `key-focus-mcp`: MCP server tools for key focus and blocker CRUD operations

### Modified Capabilities
- `task-management-api`: Task model gains a many-to-many relationship to key focuses; task response schema includes related key focuses
- `task-board-ui`: Task cards display key focus badges; blocker button added alongside notes; navigation shell restructured with tab buttons
- `task-mcp-server`: Existing task tools updated to include key focus references in responses

## Impact

- **Backend**: New models (`KeyFocus`, `TaskKeyFocus`, `Blocker`), new Alembic migration, new route modules, updated task schemas and routes
- **Frontend**: New navigation component, two new page views, updated `TaskCard` to show key focus badges and blocker controls, updated API client with new types and functions
- **MCP server**: New tool modules for key focuses and blockers, updated task tools for key focus references
- **Design system (J.A.D.S)**: May need new badge/tag component for key focus kind display
- **Database**: Three new tables, one updated association; SQLite single-writer constraint still applies
- **Helm/K8s**: No infrastructure changes expected (same backend/frontend/MCP pods)
