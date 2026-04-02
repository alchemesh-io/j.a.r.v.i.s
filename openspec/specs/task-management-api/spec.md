# Spec: task-management-api

## Purpose

Defines the requirements for the task management domain: ORM models, enums, Pydantic schemas, database session management, Alembic migrations, and all CRUD/filtering API endpoints for tasks, dailies, weeklies, and daily-task associations.

## Requirements

### Requirement: SQLAlchemy 2 database session management
The backend SHALL use SQLAlchemy 2 with a session factory and FastAPI dependency injection (`Depends(get_db)`) to provide database sessions to route handlers. Sessions SHALL auto-commit on success and rollback on exception.

#### Scenario: Session provided to route handler
- **WHEN** a route handler declares `db: Session = Depends(get_db)`
- **THEN** a new SQLAlchemy `Session` is created and yielded to the handler

#### Scenario: Session commits on success
- **WHEN** a route handler completes without raising an exception
- **THEN** the session commits all pending changes and closes

#### Scenario: Session rolls back on error
- **WHEN** a route handler raises an exception
- **THEN** the session rolls back all pending changes and closes

### Requirement: Alembic migration support
The backend SHALL use Alembic for database schema migrations. The initial migration SHALL create all tables defined by the ORM models.

#### Scenario: Initial migration creates all tables
- **WHEN** `alembic upgrade head` is executed against an empty database
- **THEN** all tables (weekly, daily, task, daily_tasks) are created

#### Scenario: Migration is reversible
- **WHEN** `alembic downgrade -1` is executed after the initial migration
- **THEN** all tables created by that migration are dropped

### Requirement: Pydantic 2 as universal data modeling layer
All request bodies, response bodies, and configuration objects SHALL be defined as Pydantic `BaseModel` subclasses. No raw `dict` usage for structured data.

#### Scenario: Request body validated by Pydantic
- **WHEN** a client sends a JSON body to a POST endpoint
- **THEN** FastAPI validates the body against the Pydantic model and returns HTTP 422 for invalid data

#### Scenario: Response serialized by Pydantic
- **WHEN** a route handler returns data
- **THEN** the response is serialized through a Pydantic `response_model` with proper JSON schema in OpenAPI docs

### Requirement: TaskType enum
The system SHALL define a `TaskType` string enum with values: `refinement`, `implementation`, `review`. This enum SHALL NOT be stored as a database lookup table.

#### Scenario: Valid task type accepted
- **WHEN** a task is created with type `refinement`
- **THEN** the task is persisted with `type = "refinement"`

#### Scenario: Invalid task type rejected
- **WHEN** a task is created with type `debugging`
- **THEN** the API returns HTTP 422 with a validation error

### Requirement: TaskStatus enum
The system SHALL define a `TaskStatus` string enum with values: `created`, `done`. This enum SHALL NOT be stored as a database lookup table.

#### Scenario: Task created with default status
- **WHEN** a task is created without specifying status
- **THEN** the task is persisted with `status = "created"`

#### Scenario: Task status updated to done
- **WHEN** a task's status is updated to `done`
- **THEN** the task is persisted with `status = "done"`

### Requirement: Weekly ORM model
The system SHALL define a `Weekly` SQLAlchemy model with columns: `id` (integer, primary key, auto-increment), `week_start` (date, not nullable, unique). It SHALL have a relationship `dailies` navigating to the `Daily` table.

#### Scenario: Weekly created with valid week start
- **WHEN** a weekly is created with `week_start = 2026-03-29`
- **THEN** a row is inserted with the given date and an auto-generated id

#### Scenario: Duplicate week start rejected
- **WHEN** a weekly is created with a `week_start` that already exists
- **THEN** the database raises a unique constraint violation

### Requirement: Daily ORM model
The system SHALL define a `Daily` SQLAlchemy model with columns: `id` (integer, primary key, auto-increment), `date` (date, not nullable, unique), `weekly_id` (integer, foreign key to `weekly.id`, on delete cascade). It SHALL have relationships: `weekly` navigating to `Weekly`, `tasks` navigating to `DailyTask`.

#### Scenario: Daily created linked to weekly
- **WHEN** a daily is created with `date = 2026-03-30` and a valid `weekly_id`
- **THEN** the daily is persisted and accessible via the weekly's `dailies` relationship

#### Scenario: Daily deleted when weekly is deleted
- **WHEN** a weekly is deleted
- **THEN** all associated dailies are cascade-deleted

### Requirement: Task ORM model
The system SHALL define a `Task` SQLAlchemy model with columns: `id` (integer, primary key, auto-increment), `jira_ticket_id` (String(20), nullable), `title` (Text, not nullable), `type` (Enum(TaskType), not nullable), `status` (Enum(TaskStatus), not nullable). It SHALL have a relationship `daily_entries` navigating to `DailyTask`.

#### Scenario: Task created with JIRA ticket
- **WHEN** a task is created with `jira_ticket_id = "JAR-123"`, `title = "Implement login"`, `type = "implementation"`, `status = "created"`
- **THEN** the task is persisted with all fields set

#### Scenario: Task created without JIRA ticket
- **WHEN** a task is created with `jira_ticket_id = null`
- **THEN** the task is persisted with `jira_ticket_id` as null

#### Scenario: JIRA ticket ID format validated
- **WHEN** a task is created with `jira_ticket_id` matching the pattern `XXX-YYY` (project short name + number)
- **THEN** the value is accepted and stored

### Requirement: DailyTask association model
The system SHALL define a `DailyTask` SQLAlchemy model as an association table with columns: `daily_id` (integer, foreign key to `daily.id`, on delete cascade), `task_id` (integer, foreign key to `task.id`, on delete cascade), `priority` (integer, not nullable). The combination of `daily_id + priority` SHALL be unique. It SHALL have relationships: `daily` navigating to `Daily`, `task` navigating to `Task`.

#### Scenario: Task added to daily with priority
- **WHEN** a task is associated with a daily at priority 1
- **THEN** a `DailyTask` row is created linking the task and daily with `priority = 1`

#### Scenario: Duplicate priority in same daily rejected
- **WHEN** two tasks are assigned the same priority within the same daily
- **THEN** the database raises a unique constraint violation on `(daily_id, priority)`

#### Scenario: Same task in multiple dailies
- **WHEN** a task is associated with daily A at priority 1 and daily B at priority 2
- **THEN** both `DailyTask` rows exist and the task appears in both dailies

### Requirement: Task response includes associated dates
The `TaskResponse` schema SHALL include a `dates` field containing a sorted list of dates the task is associated with, derived from the `daily_entries` relationship.

#### Scenario: Task with daily associations
- **WHEN** a task associated with 2026-03-28 and 2026-03-29 is retrieved
- **THEN** the response includes `"dates": ["2026-03-28", "2026-03-29"]`

#### Scenario: Task with no associations
- **WHEN** a task with no daily associations is retrieved
- **THEN** the response includes `"dates": []`

### Requirement: CRUD endpoints for Tasks
The API SHALL expose RESTful endpoints for task management under `/api/v1/tasks`. All task responses SHALL include the `dates` field.

#### Scenario: Create a task
- **WHEN** `POST /api/v1/tasks` is called with a valid task body
- **THEN** the task is created and returned with HTTP 201 (dates will be empty)

#### Scenario: List all tasks
- **WHEN** `GET /api/v1/tasks` is called
- **THEN** all tasks are returned with their associated dates as a JSON array with HTTP 200

#### Scenario: Get a task by ID
- **WHEN** `GET /api/v1/tasks/{id}` is called with a valid task ID
- **THEN** the task is returned with HTTP 200

#### Scenario: Get a non-existent task
- **WHEN** `GET /api/v1/tasks/{id}` is called with an ID that does not exist
- **THEN** HTTP 404 is returned

#### Scenario: Update a task
- **WHEN** `PATCH /api/v1/tasks/{id}` is called with partial update fields
- **THEN** the task is updated and returned with HTTP 200

#### Scenario: Delete a task
- **WHEN** `DELETE /api/v1/tasks/{id}` is called with a valid task ID
- **THEN** the task is deleted and HTTP 204 is returned

### Requirement: CRUD endpoints for Weeklies
The API SHALL expose RESTful endpoints for weekly management under `/api/v1/weeklies`.

#### Scenario: Create a weekly
- **WHEN** `POST /api/v1/weeklies` is called with a valid `week_start` date
- **THEN** the weekly is created and returned with HTTP 201

#### Scenario: List all weeklies
- **WHEN** `GET /api/v1/weeklies` is called
- **THEN** all weeklies are returned with their associated dailies

#### Scenario: Get a weekly by ID
- **WHEN** `GET /api/v1/weeklies/{id}` is called
- **THEN** the weekly is returned with its dailies and their tasks

### Requirement: CRUD endpoints for Dailies
The API SHALL expose RESTful endpoints for daily management under `/api/v1/dailies`.

#### Scenario: Create a daily
- **WHEN** `POST /api/v1/dailies` is called with a valid `date` and `weekly_id`
- **THEN** the daily is created and returned with HTTP 201

#### Scenario: Get a daily by ID
- **WHEN** `GET /api/v1/dailies/{id}` is called
- **THEN** the daily is returned with its associated tasks ordered by priority

#### Scenario: Get daily by date
- **WHEN** `GET /api/v1/dailies?date=2026-03-30` is called
- **THEN** the daily matching that date is returned, or HTTP 404 if none exists

### Requirement: Daily-Task association endpoints
The API SHALL expose endpoints to manage task associations within a daily under `/api/v1/dailies/{daily_id}/tasks`.

#### Scenario: Add a task to a daily
- **WHEN** `POST /api/v1/dailies/{daily_id}/tasks` is called with `task_id` and `priority`
- **THEN** the association is created and returned with HTTP 201

#### Scenario: Remove a task from a daily
- **WHEN** `DELETE /api/v1/dailies/{daily_id}/tasks/{task_id}` is called
- **THEN** the association is removed with HTTP 204

#### Scenario: Reorder tasks in a daily (batch priority update)
- **WHEN** `PUT /api/v1/dailies/{daily_id}/tasks/reorder` is called with a list of `{task_id, priority}` pairs
- **THEN** all task priorities for that daily are updated atomically and HTTP 200 is returned

### Requirement: Filtering tasks by date range
The API SHALL support filtering tasks by date range combining a reference date and a time scope (daily, weekly, all).

#### Scenario: Filter tasks for a specific day
- **WHEN** `GET /api/v1/tasks?date=2026-04-02&scope=daily` is called
- **THEN** only tasks associated with a daily on 2026-04-02 are returned

#### Scenario: Filter tasks for a week
- **WHEN** `GET /api/v1/tasks?date=2026-04-02&scope=weekly` is called
- **THEN** tasks associated with any daily from Sunday 2026-03-29 through Saturday 2026-04-04 are returned

#### Scenario: Get all tasks without date filter
- **WHEN** `GET /api/v1/tasks?scope=all` is called
- **THEN** all tasks are returned regardless of daily associations
