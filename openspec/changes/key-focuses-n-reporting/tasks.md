## 1. Backend Enums and Models

- [ ] 1.1 Add `KeyFocusKind`, `KeyFocusStatus`, `KeyFocusFrequency`, and `BlockerStatus` enums to `backend/app/models/enums.py`
- [ ] 1.2 Create `KeyFocus` ORM model in `backend/app/models/key_focus.py` with all fields, FK to weekly, and relationships
- [ ] 1.3 Create `TaskKeyFocus` association model in `backend/app/models/task_key_focus.py` with composite PK
- [ ] 1.4 Create `Blocker` ORM model in `backend/app/models/blocker.py` with XOR CHECK constraint on task_id/key_focus_id
- [ ] 1.5 Update `Task` model in `backend/app/models/task.py` to add `key_focuses` and `blockers` relationships
- [ ] 1.6 Register all new models in `backend/app/models/__init__.py` (or base imports)

## 2. Backend Alembic Migration

- [ ] 2.1 Generate Alembic migration creating `key_focus`, `task_key_focus`, and `blocker` tables with all constraints
- [ ] 2.2 Verify migration up/down works cleanly

## 3. Backend Pydantic Schemas

- [ ] 3.1 Create `KeyFocusCreate`, `KeyFocusUpdate`, `KeyFocusResponse` schemas in `backend/app/schemas/key_focus.py`
- [ ] 3.2 Create `TaskKeyFocusCreate`, `TaskKeyFocusResponse` schemas in `backend/app/schemas/task_key_focus.py`
- [ ] 3.3 Create `BlockerCreate`, `BlockerUpdate`, `BlockerResponse` schemas in `backend/app/schemas/blocker.py` with XOR model validator
- [ ] 3.4 Update `TaskResponse` schema to include `key_focuses` list and `blocker_count` field

## 4. Backend Key Focus Routes

- [ ] 4.1 Create `backend/app/routes/key_focuses.py` with CRUD endpoints (`POST/GET/PATCH/DELETE /api/v1/key-focuses`)
- [ ] 4.2 Add filtering by weekly_id, frequency, date+scope query params to the list endpoint
- [ ] 4.3 Create task association endpoints (`POST/GET/DELETE /api/v1/key-focuses/{id}/tasks`)
- [ ] 4.4 Create nested blocker endpoints (`POST/GET /api/v1/key-focuses/{id}/blockers`)
- [ ] 4.5 Mount the key_focuses router in `backend/app/main.py`

## 5. Backend Blocker Routes

- [ ] 5.1 Create `backend/app/routes/blockers.py` with CRUD endpoints (`POST/GET/PATCH/DELETE /api/v1/blockers`)
- [ ] 5.2 Add status filtering to the list endpoint
- [ ] 5.3 Add nested blocker endpoints on tasks (`POST/GET /api/v1/tasks/{id}/blockers`)
- [ ] 5.4 Add key focus management endpoints on tasks (`POST/GET/DELETE /api/v1/tasks/{id}/key-focuses`)
- [ ] 5.5 Mount the blockers router in `backend/app/main.py`

## 6. Backend Tests

- [ ] 6.1 Write tests for key focus CRUD operations
- [ ] 6.2 Write tests for task-key focus association endpoints
- [ ] 6.3 Write tests for blocker CRUD operations with XOR validation
- [ ] 6.4 Write tests for nested blocker endpoints on tasks and key focuses
- [ ] 6.5 Write tests for key focus filtering by date/scope
- [ ] 6.6 Verify task response includes key_focuses and blocker_count

## 7. Frontend API Client

- [ ] 7.1 Add TypeScript types for KeyFocus, Blocker, KeyFocusKind, KeyFocusStatus, KeyFocusFrequency, BlockerStatus
- [ ] 7.2 Add key focus API functions (create, list, get, update, delete)
- [ ] 7.3 Add task-key focus association API functions (add, remove, list)
- [ ] 7.4 Add blocker API functions (create, list, get, update, delete)
- [ ] 7.5 Update Task type to include key_focuses and blocker_count

## 8. Frontend Navigation Restructuring

- [ ] 8.1 Create tab-based navigation component with Tasks/Key Focuses/Reports buttons
- [ ] 8.2 Update React Router to handle `/tasks`, `/key-focuses`, `/reports` routes
- [ ] 8.3 Extract shared calendar and toolbar into reusable components from TaskBoard
- [ ] 8.4 Refactor TaskBoard to render within the new tabbed layout

## 9. Frontend Key Focus View

- [ ] 9.1 Create KeyFocusCard component with kind badge, status indicator, frequency badge, task count
- [ ] 9.2 Create KeyFocusBoard page with card grid, creation form overlay, and frequency selector
- [ ] 9.3 Implement key focus creation/edit form with kind/frequency dropdowns
- [ ] 9.4 Implement key focus deletion with confirmation dialog
- [ ] 9.5 Implement blocker panel for key focus cards (view, create, resolve blockers)

## 10. Frontend Task Board Updates

- [ ] 10.1 Add key focus badges to task cards showing associated key focus kinds
- [ ] 10.2 Add blocker count indicator to task cards
- [ ] 10.3 Add blocker button and panel to task cards (alongside notes button)
- [ ] 10.4 Add key focus multi-select field to task creation/edit forms

## 11. Frontend Reports View

- [ ] 11.1 Create Reports page component with scope toggle (daily/weekly) and calendar integration
- [ ] 11.2 Implement weekly report: previous week key focuses done section
- [ ] 11.3 Implement weekly report: previous week key focuses not done section (in_progress + failed)
- [ ] 11.4 Implement weekly report: remaining opened blockers from previous week key focuses section
- [ ] 11.5 Implement weekly report: current week key focuses section
- [ ] 11.6 Implement daily report: previous day tasks done section
- [ ] 11.7 Implement daily report: previous day tasks not done section
- [ ] 11.8 Implement daily report: remaining opened blockers from previous day tasks section
- [ ] 11.9 Implement daily report: current day tasks section
- [ ] 11.10 Add empty states for each section and for the overall report when no data exists

## 12. MCP Server Key Focus Tools

- [ ] 12.1 Create `artifacts/servers/jarvis/src/tools/key_focuses.py` with CRUD tools (create, get, list, update, delete)
- [ ] 12.2 Add task-key focus association tools (add_task_to_key_focus, remove_task_from_key_focus, list_key_focus_tasks)

## 13. MCP Server Blocker Tools

- [ ] 13.1 Create `artifacts/servers/jarvis/src/tools/blockers.py` with CRUD tools (create, get, list, update, delete)

## 14. MCP Server Task Tool Updates

- [ ] 14.1 Update `get_task` tool to include key_focuses and blockers in response
- [ ] 14.2 Update `list_tasks` tool to include key focus summaries and blocker counts
- [ ] 14.3 Update `delete_task` tool message to mention cascading key focus/blocker deletion

## 15. MCP Server Tests

- [ ] 15.1 Write tests for key focus MCP tools
- [ ] 15.2 Write tests for blocker MCP tools
- [ ] 15.3 Update existing task tool tests to verify new response fields
