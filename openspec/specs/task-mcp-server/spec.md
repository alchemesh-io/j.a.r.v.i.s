# Spec: task-mcp-server

## Purpose

Defines the requirements for the MCP (Model Context Protocol) server that exposes task management tools to AI agents, communicating with the backend exclusively via its REST API.

## Requirements

### Requirement: Standalone MCP server process
The MCP server SHALL run as a standalone Python process using the official `mcp` Python SDK, deployed as its own Kubernetes pod.

#### Scenario: MCP server starts and accepts connections
- **WHEN** the MCP server process is started
- **THEN** it listens for MCP protocol connections and advertises its available tools

### Requirement: Backend API client
The MCP server SHALL communicate with the backend exclusively via its REST API (`/api/v1/`). It SHALL NOT access the SQLite database directly. The backend URL SHALL be configurable via the `BACKEND_URL` environment variable.

#### Scenario: MCP server calls backend API
- **WHEN** the MCP server needs to read or write task data
- **THEN** it sends HTTP requests to the backend's `/api/v1/` endpoints

#### Scenario: Backend URL configured via environment
- **WHEN** `BACKEND_URL` is set to `http://jarvis-backend:8000`
- **THEN** the MCP server directs all API calls to that base URL

#### Scenario: Backend unavailable
- **WHEN** the MCP server cannot reach the backend
- **THEN** MCP tool calls return an error indicating the backend is unreachable

### Requirement: Task CRUD tools
The MCP server SHALL expose tools for creating, reading, updating, and deleting tasks.

#### Scenario: Agent creates a task via MCP
- **WHEN** an agent calls the `create_task` MCP tool with title, type, and optional JIRA ticket ID
- **THEN** the MCP server calls `POST /api/v1/tasks` and returns the created task

#### Scenario: Agent lists tasks via MCP
- **WHEN** an agent calls the `list_tasks` MCP tool
- **THEN** the MCP server calls `GET /api/v1/tasks` and returns all tasks

#### Scenario: Agent updates a task via MCP
- **WHEN** an agent calls the `update_task` MCP tool with a task ID and updated fields
- **THEN** the MCP server calls `PATCH /api/v1/tasks/{id}` and returns the updated task

#### Scenario: Agent deletes a task via MCP
- **WHEN** an agent calls the `delete_task` MCP tool with a task ID
- **THEN** the MCP server calls `DELETE /api/v1/tasks/{id}` and confirms deletion

### Requirement: Daily planning tools
The MCP server SHALL expose tools for managing daily planning: create a daily, add/remove tasks from a daily, list tasks for a date.

#### Scenario: Agent creates a daily plan via MCP
- **WHEN** an agent calls the `create_daily` MCP tool with a date
- **THEN** the MCP server calls `POST /api/v1/dailies` to create the daily entry

#### Scenario: Agent adds task to daily via MCP
- **WHEN** an agent calls the `add_task_to_daily` MCP tool with daily ID, task ID, and priority
- **THEN** the MCP server calls `POST /api/v1/dailies/{daily_id}/tasks`

#### Scenario: Agent lists tasks for a date via MCP
- **WHEN** an agent calls the `list_daily_tasks` MCP tool with a date
- **THEN** the MCP server calls `GET /api/v1/dailies?date={date}` and returns tasks ordered by priority

### Requirement: Weekly planning tools
The MCP server SHALL expose tools for querying weekly planning: list tasks for a week, get weekly summary.

#### Scenario: Agent lists weekly tasks via MCP
- **WHEN** an agent calls the `list_weekly_tasks` MCP tool with a date in the target week
- **THEN** the MCP server calls `GET /api/v1/tasks?date={date}&scope=weekly` and returns tasks grouped by day
