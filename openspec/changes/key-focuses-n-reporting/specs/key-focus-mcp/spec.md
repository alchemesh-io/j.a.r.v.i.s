## ADDED Requirements

### Requirement: Key focus CRUD tools
The MCP server SHALL expose tools for creating, reading, updating, listing, and deleting key focuses. The `get_key_focus` tool response SHALL include associated tasks and blockers.

#### Scenario: Agent creates a key focus via MCP
- **WHEN** an agent calls the `create_key_focus` MCP tool with title, kind, frequency, and weekly_id
- **THEN** the MCP server calls `POST /api/v1/key-focuses` and returns the created key focus

#### Scenario: Agent lists key focuses via MCP
- **WHEN** an agent calls the `list_key_focuses` MCP tool with optional date and scope filters
- **THEN** the MCP server calls `GET /api/v1/key-focuses` with query params and returns the results

#### Scenario: Agent gets a key focus with details via MCP
- **WHEN** an agent calls the `get_key_focus` MCP tool for a key focus
- **THEN** the response includes the key focus data plus associated tasks and blockers

#### Scenario: Agent updates a key focus via MCP
- **WHEN** an agent calls the `update_key_focus` MCP tool with a key focus ID and updated fields
- **THEN** the MCP server calls `PATCH /api/v1/key-focuses/{id}` and returns the updated key focus

#### Scenario: Agent deletes a key focus via MCP
- **WHEN** an agent calls the `delete_key_focus` MCP tool with a key focus ID
- **THEN** the MCP server calls `DELETE /api/v1/key-focuses/{id}` and returns a confirmation message

### Requirement: Task-KeyFocus association tools
The MCP server SHALL expose tools for linking and unlinking tasks to/from key focuses.

#### Scenario: Agent links a task to a key focus via MCP
- **WHEN** an agent calls the `add_task_to_key_focus` MCP tool with key_focus_id and task_id
- **THEN** the MCP server calls `POST /api/v1/key-focuses/{id}/tasks` and returns the association

#### Scenario: Agent removes a task from a key focus via MCP
- **WHEN** an agent calls the `remove_task_from_key_focus` MCP tool with key_focus_id and task_id
- **THEN** the MCP server calls `DELETE /api/v1/key-focuses/{id}/tasks/{task_id}` and returns confirmation

#### Scenario: Agent lists tasks for a key focus via MCP
- **WHEN** an agent calls the `list_key_focus_tasks` MCP tool with a key_focus_id
- **THEN** the MCP server calls `GET /api/v1/key-focuses/{id}/tasks` and returns the task list

### Requirement: Blocker CRUD tools
The MCP server SHALL expose tools for creating, reading, updating, listing, and deleting blockers.

#### Scenario: Agent creates a blocker for a task via MCP
- **WHEN** an agent calls the `create_blocker` MCP tool with title and task_id
- **THEN** the MCP server calls `POST /api/v1/blockers` and returns the created blocker

#### Scenario: Agent creates a blocker for a key focus via MCP
- **WHEN** an agent calls the `create_blocker` MCP tool with title and key_focus_id
- **THEN** the MCP server calls `POST /api/v1/blockers` and returns the created blocker

#### Scenario: Agent lists blockers via MCP
- **WHEN** an agent calls the `list_blockers` MCP tool with optional status filter
- **THEN** the MCP server calls `GET /api/v1/blockers` and returns the results

#### Scenario: Agent updates a blocker status via MCP
- **WHEN** an agent calls the `update_blocker` MCP tool with blocker ID and `status = "resolved"`
- **THEN** the MCP server calls `PATCH /api/v1/blockers/{id}` and returns the updated blocker

#### Scenario: Agent deletes a blocker via MCP
- **WHEN** an agent calls the `delete_blocker` MCP tool with a blocker ID
- **THEN** the MCP server calls `DELETE /api/v1/blockers/{id}` and returns confirmation
