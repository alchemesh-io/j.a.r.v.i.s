## Why

Tasks in JARVIS currently only support a title, dates, and source ID — there is no way to attach detailed notes or context. Users need to capture meeting notes, implementation details, acceptance criteria, and other markdown-rich content directly on tasks without leaving the app.

## What Changes

- **New `task_note` database table** with a many-to-one relationship to `task` (one task has multiple notes)
- **New REST API endpoints** under `/api/v1/tasks/{task_id}/notes` for full CRUD on notes
- **Cascade deletion**: deleting a task deletes all its notes; individual notes can also be deleted
- **Task board UI**: new button on task cards to open a notes panel; markdown rendering in read mode, raw editing in edit mode; deletion confirmation dialog for tasks
- **MCP server**: new tools for creating, listing, updating, and deleting task notes via the backend API

## Capabilities

### New Capabilities
- `task-notes-api`: Backend data model and REST API for managing markdown notes attached to tasks
- `task-notes-ui`: Task board UI additions for viewing, creating, editing, and deleting notes with markdown rendering
- `task-notes-mcp`: MCP server tools exposing note management to AI agents

### Modified Capabilities
- `task-management-api`: Task deletion now cascades to notes; TaskResponse may include note count
- `task-board-ui`: Task cards gain a notes access button; task deletion now requires confirmation
- `task-mcp-server`: Delete task tool must account for cascading note deletion

## Impact

- **Backend**: New SQLAlchemy model, Alembic migration, Pydantic schemas, and route module
- **Frontend**: New UI components for notes panel/modal, markdown renderer dependency, updated TaskCard component
- **MCP server**: New tool module and API client methods for notes
- **Database**: Schema change (new table) — requires migration
- **Helm**: No changes expected (no new services, just new endpoints on existing backend)
