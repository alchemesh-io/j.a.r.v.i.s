## 1. Backend Enums and Models

- [x] 1.1 Add `KeyFocusKind`, `KeyFocusStatus`, `KeyFocusFrequency`, and `BlockerStatus` enums to `backend/app/models/enums.py`
- [x] 1.2 Create `KeyFocus` ORM model in `backend/app/models/key_focus.py` with all fields, FK to weekly, and relationships
- [x] 1.3 Create `TaskKeyFocus` association model in `backend/app/models/task_key_focus.py` with composite PK
- [x] 1.4 Create `Blocker` ORM model in `backend/app/models/blocker.py` with XOR CHECK constraint on task_id/key_focus_id
- [x] 1.5 Update `Task` model in `backend/app/models/task.py` to add `key_focuses` and `blockers` relationships
- [x] 1.6 Register all new models in `backend/app/models/__init__.py` (or base imports)

## 2. Backend Alembic Migration

- [x] 2.1 Generate Alembic migration creating `key_focus`, `task_key_focus`, and `blocker` tables with all constraints
- [x] 2.2 Verify migration up/down works cleanly

## 3. Backend Pydantic Schemas

- [x] 3.1 Create `KeyFocusCreate`, `KeyFocusUpdate`, `KeyFocusResponse` schemas in `backend/app/schemas/key_focus.py`
- [x] 3.2 Create `TaskKeyFocusCreate`, `TaskKeyFocusResponse` schemas in `backend/app/schemas/task_key_focus.py`
- [x] 3.3 Create `BlockerCreate`, `BlockerUpdate`, `BlockerResponse` schemas in `backend/app/schemas/blocker.py` with XOR model validator
- [x] 3.4 Update `TaskResponse` schema to include `key_focuses` list and `blocker_count` field

## 4. Backend Key Focus Routes

- [x] 4.1 Create `backend/app/routes/key_focuses.py` with CRUD endpoints (`POST/GET/PATCH/DELETE /api/v1/key-focuses`)
- [x] 4.2 Add filtering by weekly_id, frequency, date+scope query params to the list endpoint
- [x] 4.3 Create task association endpoints (`POST/GET/DELETE /api/v1/key-focuses/{id}/tasks`)
- [x] 4.4 Create nested blocker endpoints (`POST/GET /api/v1/key-focuses/{id}/blockers`)
- [x] 4.5 Mount the key_focuses router in `backend/app/main.py`

## 5. Backend Blocker Routes

- [x] 5.1 Create `backend/app/routes/blockers.py` with CRUD endpoints (`POST/GET/PATCH/DELETE /api/v1/blockers`)
- [x] 5.2 Add status filtering to the list endpoint
- [x] 5.3 Add nested blocker endpoints on tasks (`POST/GET /api/v1/tasks/{id}/blockers`)
- [x] 5.4 Add key focus management endpoints on tasks (`POST/GET/DELETE /api/v1/tasks/{id}/key-focuses`)
- [x] 5.5 Mount the blockers router in `backend/app/main.py`

## 6. Backend Tests

- [x] 6.1 Write tests for key focus CRUD operations
- [x] 6.2 Write tests for task-key focus association endpoints
- [x] 6.3 Write tests for blocker CRUD operations with XOR validation
- [x] 6.4 Write tests for nested blocker endpoints on tasks and key focuses
- [x] 6.5 Write tests for key focus filtering by date/scope
- [x] 6.6 Verify task response includes key_focuses and blocker_count

## 7. Frontend API Client

- [x] 7.1 Add TypeScript types for KeyFocus, Blocker, KeyFocusKind, KeyFocusStatus, KeyFocusFrequency, BlockerStatus
- [x] 7.2 Add key focus API functions (create, list, get, update, delete)
- [x] 7.3 Add task-key focus association API functions (add, remove, list)
- [x] 7.4 Add blocker API functions (create, list, get, update, delete)
- [x] 7.5 Update Task type to include key_focuses and blocker_count

## 8. Frontend Navigation Restructuring

- [x] 8.1 Create tab-based navigation component with Tasks/Key Focuses/Reports buttons
- [x] 8.2 Update React Router to handle `/tasks`, `/key-focuses`, `/reports` routes
- [x] 8.3 Extract shared calendar and toolbar into reusable components from TaskBoard
- [x] 8.4 Refactor TaskBoard to render within the new tabbed layout

## 9. Frontend Key Focus View

- [x] 9.1 Create KeyFocusCard component with kind badge, status indicator, frequency badge, task count
- [x] 9.2 Create KeyFocusBoard page with card grid, creation form overlay, and frequency selector
- [x] 9.3 Implement key focus creation/edit form with kind/frequency dropdowns
- [x] 9.4 Implement key focus deletion with confirmation dialog
- [x] 9.5 Implement blocker panel for key focus cards (view, create, resolve blockers)

## 10. Frontend Task Board Updates

- [x] 10.1 Add key focus badges to task cards showing associated key focus kinds
- [x] 10.2 Add blocker count indicator to task cards
- [x] 10.3 Add blocker button and panel to task cards (alongside notes button)
- [x] 10.4 Add key focus multi-select field to task creation/edit forms

## 11. Frontend Reports View

- [x] 11.1 Create Reports page component with scope toggle (daily/weekly) and calendar integration
- [x] 11.2 Implement weekly report: previous week key focuses done section
- [x] 11.3 Implement weekly report: previous week key focuses not done section (in_progress + failed)
- [x] 11.4 Implement weekly report: remaining opened blockers from previous week key focuses section
- [x] 11.5 Implement weekly report: current week key focuses section
- [x] 11.6 Implement daily report: previous day tasks done section
- [x] 11.7 Implement daily report: previous day tasks not done section
- [x] 11.8 Implement daily report: remaining opened blockers from previous day tasks section
- [x] 11.9 Implement daily report: current day tasks section
- [x] 11.10 Add empty states for each section and for the overall report when no data exists

## 12. MCP Server Key Focus Tools

- [x] 12.1 Create `artifacts/servers/jarvis/src/tools/key_focuses.py` with CRUD tools (create, get, list, update, delete)
- [x] 12.2 Add task-key focus association tools (add_task_to_key_focus, remove_task_from_key_focus, list_key_focus_tasks)

## 13. MCP Server Blocker Tools

- [x] 13.1 Create `artifacts/servers/jarvis/src/tools/blockers.py` with CRUD tools (create, get, list, update, delete)

## 14. MCP Server Task Tool Updates

- [x] 14.1 Update `get_task` tool to include key_focuses and blockers in response
- [x] 14.2 Update `list_tasks` tool to include key focus summaries and blocker counts
- [x] 14.3 Update `delete_task` tool message to mention cascading key focus/blocker deletion

## 15. MCP Server Tests

- [x] 15.1 Write tests for key focus MCP tools
- [x] 15.2 Write tests for blocker MCP tools
- [x] 15.3 Update existing task tool tests to verify new response fields
