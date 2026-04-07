## Context

JARVIS tasks currently store only a title, type, status, and source metadata. The `task` table has no mechanism for attaching rich-text content. Users need to capture notes (meeting context, implementation details, acceptance criteria) directly on tasks. The system spans three layers: a Python/FastAPI backend with SQLite, a React/Vite frontend, and a FastMCP-based MCP server — all of which must be extended.

## Goals / Non-Goals

**Goals:**
- Allow multiple markdown notes per task, each independently creatable, editable, and deletable
- Cascade-delete all notes when a task is deleted
- Render markdown in read mode within the task board UI
- Expose note management to AI agents via MCP tools
- Add a deletion confirmation dialog for tasks (since deletion is now more destructive)

**Non-Goals:**
- Note attachments (images, files) — text-only for now
- Note versioning or edit history
- Collaborative editing or real-time sync
- Full-text search across notes
- Note ordering or pinning

## Decisions

### Decision 1: Separate `task_note` table (one-to-many)

Notes live in a dedicated `task_note` table with a foreign key to `task.id` and `ON DELETE CASCADE`. Each note has its own `id`, `content` (markdown text), and `created_at`/`updated_at` timestamps.

**Why**: Keeps the task model lean, supports unlimited notes per task, and allows independent CRUD on individual notes. The alternative — a single `notes` text column on the task table — would limit users to one note blob and make partial updates awkward.

### Decision 2: Nested REST endpoints under `/api/v1/tasks/{task_id}/notes`

Note endpoints are nested under the task resource: `POST`, `GET` (list), `PATCH /{note_id}`, `DELETE /{note_id}`.

**Why**: Notes are subordinate to tasks — they have no meaning outside a task context. Nesting makes the ownership explicit in the URL and simplifies authorization (access to a task implies access to its notes). A flat `/api/v1/notes?task_id=X` approach was considered but adds query parameter coupling and less intuitive API design.

### Decision 3: Notes panel as a slide-over/modal in the task board

Clicking a notes button on a task card opens a panel showing all notes for that task. Each note is rendered as markdown in read mode, with an edit button to switch to a textarea. New notes are added via a form at the top.

**Why**: A modal/panel keeps the user in context of the task board. A separate page was considered but breaks the single-page flow. The panel approach is consistent with the existing edit overlay pattern.

### Decision 4: `react-markdown` for markdown rendering

Use `react-markdown` (with `remark-gfm` for tables/checkboxes) to render note content in the UI.

**Why**: Lightweight, well-maintained, React-native. Alternatives like `marked` + `dangerouslySetInnerHTML` introduce XSS risk. `react-markdown` renders to React elements directly, avoiding raw HTML injection.

### Decision 5: Task deletion confirmation dialog

Add a confirmation dialog before deleting a task, warning that all associated notes will also be deleted.

**Why**: With notes attached, task deletion becomes more destructive. A simple confirm dialog prevents accidental data loss. This applies to both UI and is informational for MCP (agents should confirm with the user).

## Risks / Trade-offs

- **SQLite single-writer**: High note activity could contend with task updates. Mitigated by keeping note writes lightweight and the planned PostgreSQL migration.
- **No pagination on notes list**: If a task accumulates many notes, the GET endpoint returns all of them. Acceptable for personal use; add pagination later if needed.
- **Markdown rendering in frontend**: Adds a new dependency (`react-markdown` + `remark-gfm`). Mitigated by choosing a minimal, well-maintained library.
- **Migration**: Adding a new table is forward-only and non-destructive. Rollback is a simple `DROP TABLE task_note`. No data migration needed since this is a net-new feature.
