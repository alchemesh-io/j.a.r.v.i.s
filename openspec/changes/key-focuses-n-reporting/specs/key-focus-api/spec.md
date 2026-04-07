## ADDED Requirements

### Requirement: KeyFocusKind enum
The system SHALL define a `KeyFocusKind` string enum with values: `delivery`, `learning`, `support`, `operational`, `side_quest`.

#### Scenario: Valid key focus kind accepted
- **WHEN** a key focus is created with kind `delivery`
- **THEN** the key focus is persisted with `kind = "delivery"`

#### Scenario: Invalid key focus kind rejected
- **WHEN** a key focus is created with kind `personal`
- **THEN** the API returns HTTP 422 with a validation error

### Requirement: KeyFocusStatus enum
The system SHALL define a `KeyFocusStatus` string enum with values: `in_progress`, `succeed`, `failed`.

#### Scenario: Key focus created with default status
- **WHEN** a key focus is created without specifying status
- **THEN** the key focus is persisted with `status = "in_progress"`

#### Scenario: Key focus status updated to succeed
- **WHEN** a key focus's status is updated to `succeed`
- **THEN** the key focus is persisted with `status = "succeed"`

### Requirement: KeyFocusFrequency enum
The system SHALL define a `KeyFocusFrequency` string enum with values: `weekly`, `quarterly`.

#### Scenario: Weekly key focus created
- **WHEN** a key focus is created with frequency `weekly`
- **THEN** the key focus is persisted with `frequency = "weekly"`

#### Scenario: Quarterly key focus created
- **WHEN** a key focus is created with frequency `quarterly`
- **THEN** the key focus is persisted with `frequency = "quarterly"`

### Requirement: KeyFocus ORM model
The system SHALL define a `KeyFocus` SQLAlchemy model with columns: `id` (integer, primary key, auto-increment), `title` (Text, not nullable), `description` (Text, nullable), `kind` (Enum(KeyFocusKind), not nullable), `status` (Enum(KeyFocusStatus), not nullable, default `in_progress`), `frequency` (Enum(KeyFocusFrequency), not nullable), `weekly_id` (integer, foreign key to `weekly.id`, on delete cascade, not nullable). It SHALL have relationships: `weekly` navigating to `Weekly`, `tasks` navigating to `Task` via `TaskKeyFocus`, `blockers` navigating to `Blocker`.

#### Scenario: Key focus created with all fields
- **WHEN** a key focus is created with title, description, kind `delivery`, frequency `weekly`, and a valid weekly_id
- **THEN** the key focus is persisted with all fields set and `status = "in_progress"`

#### Scenario: Key focus deleted when weekly is deleted
- **WHEN** a weekly with associated key focuses is deleted
- **THEN** all associated key focuses are cascade-deleted

#### Scenario: Key focus created without description
- **WHEN** a key focus is created with `description = null`
- **THEN** the key focus is persisted with description as null

### Requirement: TaskKeyFocus association model
The system SHALL define a `TaskKeyFocus` SQLAlchemy model as an association table with columns: `task_id` (integer, foreign key to `task.id`, on delete cascade), `key_focus_id` (integer, foreign key to `key_focus.id`, on delete cascade). The composite primary key SHALL be `(task_id, key_focus_id)`.

#### Scenario: Task linked to key focus
- **WHEN** a task is associated with a key focus
- **THEN** a `TaskKeyFocus` row is created linking the two entities

#### Scenario: Same task linked to multiple key focuses
- **WHEN** a task is associated with key focus A and key focus B
- **THEN** two `TaskKeyFocus` rows exist and both key focuses appear in the task's associations

#### Scenario: Association removed when task is deleted
- **WHEN** a task with key focus associations is deleted
- **THEN** all `TaskKeyFocus` rows for that task are cascade-deleted

#### Scenario: Association removed when key focus is deleted
- **WHEN** a key focus with task associations is deleted
- **THEN** all `TaskKeyFocus` rows for that key focus are cascade-deleted

### Requirement: KeyFocus Pydantic schemas
The system SHALL define Pydantic schemas: `KeyFocusCreate` (title, description, kind, frequency, weekly_id; status optional defaulting to in_progress), `KeyFocusUpdate` (all fields optional for partial update), `KeyFocusResponse` (all fields plus id, task_count integer, blocker_count integer, with `from_attributes = True`).

#### Scenario: Create schema validates required fields
- **WHEN** a KeyFocusCreate is instantiated without title
- **THEN** validation fails with a missing field error

#### Scenario: Response includes computed counts
- **WHEN** a key focus with 3 tasks and 1 blocker is serialized
- **THEN** the response includes `task_count: 3` and `blocker_count: 1`

### Requirement: Alembic migration for key_focus and task_key_focus tables
The system SHALL include an Alembic migration that creates the `key_focus` table and the `task_key_focus` association table with all columns, foreign key constraints, and cascade delete rules.

#### Scenario: Migration creates tables
- **WHEN** `alembic upgrade head` is executed
- **THEN** the `key_focus` and `task_key_focus` tables are created with all columns and constraints

#### Scenario: Migration is reversible
- **WHEN** `alembic downgrade -1` is executed after the migration
- **THEN** the `key_focus` and `task_key_focus` tables are dropped

### Requirement: CRUD endpoints for KeyFocuses
The API SHALL expose RESTful endpoints under `/api/v1/key-focuses` for key focus management.

#### Scenario: Create a key focus
- **WHEN** `POST /api/v1/key-focuses` is called with valid body including title, kind, frequency, and weekly_id
- **THEN** the key focus is created and returned with HTTP 201

#### Scenario: List key focuses
- **WHEN** `GET /api/v1/key-focuses` is called
- **THEN** all key focuses are returned with task_count and blocker_count as a JSON array with HTTP 200

#### Scenario: List key focuses filtered by weekly
- **WHEN** `GET /api/v1/key-focuses?weekly_id=1` is called
- **THEN** only key focuses associated with weekly 1 are returned

#### Scenario: List key focuses filtered by frequency
- **WHEN** `GET /api/v1/key-focuses?frequency=weekly` is called
- **THEN** only weekly key focuses are returned

#### Scenario: Get a key focus by ID
- **WHEN** `GET /api/v1/key-focuses/{id}` is called with a valid ID
- **THEN** the key focus is returned with HTTP 200

#### Scenario: Get a non-existent key focus
- **WHEN** `GET /api/v1/key-focuses/{id}` is called with an ID that does not exist
- **THEN** HTTP 404 is returned

#### Scenario: Update a key focus
- **WHEN** `PATCH /api/v1/key-focuses/{id}` is called with partial update fields
- **THEN** the key focus is updated and returned with HTTP 200

#### Scenario: Delete a key focus
- **WHEN** `DELETE /api/v1/key-focuses/{id}` is called with a valid ID
- **THEN** the key focus and all its associations are deleted and HTTP 204 is returned

### Requirement: Task-KeyFocus association endpoints
The API SHALL expose endpoints to manage task associations for a key focus under `/api/v1/key-focuses/{key_focus_id}/tasks`.

#### Scenario: Add a task to a key focus
- **WHEN** `POST /api/v1/key-focuses/{key_focus_id}/tasks` is called with `{"task_id": 1}`
- **THEN** the association is created and returned with HTTP 201

#### Scenario: Remove a task from a key focus
- **WHEN** `DELETE /api/v1/key-focuses/{key_focus_id}/tasks/{task_id}` is called
- **THEN** the association is removed with HTTP 204

#### Scenario: List tasks for a key focus
- **WHEN** `GET /api/v1/key-focuses/{key_focus_id}/tasks` is called
- **THEN** all tasks associated with the key focus are returned with HTTP 200

#### Scenario: Add task to non-existent key focus
- **WHEN** `POST /api/v1/key-focuses/999/tasks` is called and key focus 999 does not exist
- **THEN** HTTP 404 is returned with detail "Key focus not found"

### Requirement: Filtering key focuses by date and scope
The API SHALL support filtering key focuses by date range combining a reference date and a time scope (weekly, quarterly, all).

#### Scenario: Filter key focuses for a specific week
- **WHEN** `GET /api/v1/key-focuses?date=2026-04-02&scope=weekly` is called
- **THEN** only key focuses whose weekly's week_start matches the week containing that date are returned

#### Scenario: Filter quarterly key focuses
- **WHEN** `GET /api/v1/key-focuses?date=2026-04-02&scope=quarterly` is called
- **THEN** quarterly key focuses whose weekly_id falls within the quarter containing that date are returned

#### Scenario: Get all key focuses without filter
- **WHEN** `GET /api/v1/key-focuses?scope=all` is called
- **THEN** all key focuses are returned regardless of time scope
