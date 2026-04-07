## MODIFIED Requirements

### Requirement: Task CRUD tools
The MCP server SHALL expose tools for creating, reading, updating, and deleting tasks. The `get_task` tool response SHALL include a `notes` array containing all notes for the task. The `delete_task` tool SHALL inform the caller that associated notes will also be deleted.

#### Scenario: Agent creates a task via MCP
- **WHEN** an agent calls the `create_task` MCP tool with title, type, and optional source info
- **THEN** the MCP server calls `POST /api/v1/tasks` and returns the created task

#### Scenario: Agent lists tasks via MCP
- **WHEN** an agent calls the `list_tasks` MCP tool
- **THEN** the MCP server calls `GET /api/v1/tasks` and returns all tasks with note counts

#### Scenario: Agent gets a task with notes via MCP
- **WHEN** an agent calls the `get_task` MCP tool for a task with notes
- **THEN** the response includes the task data plus a `notes` array fetched from `GET /api/v1/tasks/{id}/notes`

#### Scenario: Agent updates a task via MCP
- **WHEN** an agent calls the `update_task` MCP tool with a task ID and updated fields
- **THEN** the MCP server calls `PATCH /api/v1/tasks/{id}` and returns the updated task

#### Scenario: Agent deletes a task via MCP
- **WHEN** an agent calls the `delete_task` MCP tool with a task ID
- **THEN** the MCP server calls `DELETE /api/v1/tasks/{id}` and returns a message confirming the task and its notes were deleted
