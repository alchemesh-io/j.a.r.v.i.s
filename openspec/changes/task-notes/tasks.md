## 1. Backend — Data Model & Migration

- [x] 1.1 Create `app/models/task_note.py` with TaskNote SQLAlchemy model (id, task_id FK, content, created_at, updated_at)
- [x] 1.2 Add `notes` relationship to Task model in `app/models/task.py` with cascade all, delete-orphan
- [x] 1.3 Register TaskNote in `app/models/__init__.py`
- [x] 1.4 Generate Alembic migration for the `task_note` table
- [x] 1.5 Create `app/schemas/task_note.py` with TaskNoteCreate, TaskNoteUpdate, TaskNoteResponse schemas
- [x] 1.6 Add `note_count: int` field to TaskResponse schema and update `_task_to_response` helper in routes

## 2. Backend — API Endpoints

- [x] 2.1 Create `app/routes/task_notes.py` with nested router under `/tasks/{task_id}/notes`
- [x] 2.2 Implement POST endpoint — create note for a task (validate task exists, validate non-empty content)
- [x] 2.3 Implement GET endpoint — list all notes for a task (ordered by created_at desc)
- [x] 2.4 Implement PATCH `/{note_id}` endpoint — update note content (validate note belongs to task)
- [x] 2.5 Implement DELETE `/{note_id}` endpoint — delete a single note (validate note belongs to task)
- [x] 2.6 Mount the task_notes router in `app/main.py`

## 3. Backend — Tests

- [x] 3.1 Write tests for note CRUD operations (create, list, update, delete)
- [x] 3.2 Write tests for cascade deletion (deleting task deletes notes)
- [x] 3.3 Write tests for validation (empty content, non-existent task, note belonging to wrong task)

## 4. Frontend — Notes Panel

- [x] 4.1 Install `react-markdown` and `remark-gfm` dependencies
- [x] 4.2 Create NotePanel component (slide-over/modal with task title header, close button)
- [x] 4.3 Implement note list rendering with markdown display (read mode)
- [x] 4.4 Implement new note creation form (textarea + Save button, disable on empty)
- [x] 4.5 Implement inline note editing (edit button toggles textarea, Save/Cancel)
- [x] 4.6 Implement note deletion with confirmation prompt

## 5. Frontend — Task Board Integration

- [x] 5.1 Add notes button to TaskCard component with note count badge
- [x] 5.2 Add `note_count` to the frontend task API types and fetch client
- [x] 5.3 Wire NotePanel open/close to the notes button on TaskCard
- [x] 5.4 Add API client functions for note CRUD (create, list, update, delete)
- [x] 5.5 Add task deletion confirmation dialog to TaskBoard
- [x] 5.6 Invalidate task queries on note create/delete (to refresh note_count)

## 6. MCP Server — Note Tools

- [x] 6.1 Add note API client methods to `core/api_client.py` (create, list, update, delete notes)
- [x] 6.2 Create `src/tools/task_notes.py` with MCP tools: create_task_note, list_task_notes, update_task_note, delete_task_note
- [x] 6.3 Update `get_task` tool to include notes in the response (fetch from notes endpoint)
- [x] 6.4 Update `delete_task` tool response message to mention cascading note deletion

## 7. MCP Server — Tests

- [x] 7.1 Write tests for note MCP tools (create, list, update, delete)
- [x] 7.2 Write tests for updated get_task and delete_task tools
