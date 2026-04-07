## ADDED Requirements

### Requirement: Note CRUD MCP tools
The MCP server SHALL expose tools for creating, listing, updating, and deleting notes on tasks, communicating with the backend via its REST API.

#### Scenario: Agent creates a note via MCP
- **WHEN** an agent calls the `create_task_note` MCP tool with `task_id` and `content`
- **THEN** the MCP server calls `POST /api/v1/tasks/{task_id}/notes` and returns the created note

#### Scenario: Agent lists notes for a task via MCP
- **WHEN** an agent calls the `list_task_notes` MCP tool with `task_id`
- **THEN** the MCP server calls `GET /api/v1/tasks/{task_id}/notes` and returns all notes

#### Scenario: Agent updates a note via MCP
- **WHEN** an agent calls the `update_task_note` MCP tool with `task_id`, `note_id`, and `content`
- **THEN** the MCP server calls `PATCH /api/v1/tasks/{task_id}/notes/{note_id}` and returns the updated note

#### Scenario: Agent deletes a note via MCP
- **WHEN** an agent calls the `delete_task_note` MCP tool with `task_id` and `note_id`
- **THEN** the MCP server calls `DELETE /api/v1/tasks/{task_id}/notes/{note_id}` and confirms deletion

### Requirement: Note content in task retrieval
The `get_task` MCP tool SHALL include a `notes` field in the response containing all notes for the task.

#### Scenario: Agent retrieves task with notes
- **WHEN** an agent calls `get_task` for a task that has 2 notes
- **THEN** the response includes the task data plus a `notes` array with both notes
