## ADDED Requirements

### Requirement: BlockerStatus enum
The system SHALL define a `BlockerStatus` string enum with values: `opened`, `resolved`.

#### Scenario: Blocker created with default status
- **WHEN** a blocker is created without specifying status
- **THEN** the blocker is persisted with `status = "opened"`

#### Scenario: Blocker status updated to resolved
- **WHEN** a blocker's status is updated to `resolved`
- **THEN** the blocker is persisted with `status = "resolved"`

### Requirement: Blocker ORM model
The system SHALL define a `Blocker` SQLAlchemy model with columns: `id` (integer, primary key, auto-increment), `title` (Text, not nullable), `description` (Text, nullable), `status` (Enum(BlockerStatus), not nullable, default `opened`), `task_id` (integer, foreign key to `task.id`, on delete cascade, nullable), `key_focus_id` (integer, foreign key to `key_focus.id`, on delete cascade, nullable). A CHECK constraint SHALL enforce that exactly one of `task_id` or `key_focus_id` is non-null (XOR). It SHALL have relationships: `task` navigating to `Task`, `key_focus` navigating to `KeyFocus`.

#### Scenario: Blocker created for a task
- **WHEN** a blocker is created with `task_id = 1` and `key_focus_id = null`
- **THEN** the blocker is persisted linked to the task

#### Scenario: Blocker created for a key focus
- **WHEN** a blocker is created with `task_id = null` and `key_focus_id = 2`
- **THEN** the blocker is persisted linked to the key focus

#### Scenario: Blocker with both references rejected
- **WHEN** a blocker is created with both `task_id = 1` and `key_focus_id = 2`
- **THEN** the API returns HTTP 422 with a validation error

#### Scenario: Blocker with no reference rejected
- **WHEN** a blocker is created with both `task_id = null` and `key_focus_id = null`
- **THEN** the API returns HTTP 422 with a validation error

#### Scenario: Blocker cascade-deleted when task is deleted
- **WHEN** a task with associated blockers is deleted
- **THEN** all associated blockers are cascade-deleted

#### Scenario: Blocker cascade-deleted when key focus is deleted
- **WHEN** a key focus with associated blockers is deleted
- **THEN** all associated blockers are cascade-deleted

### Requirement: Blocker Pydantic schemas
The system SHALL define Pydantic schemas: `BlockerCreate` (title, description optional, task_id optional, key_focus_id optional; status optional defaulting to opened), `BlockerUpdate` (title optional, description optional, status optional), `BlockerResponse` (all fields plus id, with `from_attributes = True`). `BlockerCreate` SHALL include a model validator ensuring exactly one of task_id or key_focus_id is set.

#### Scenario: Create schema validates XOR constraint
- **WHEN** a BlockerCreate is instantiated with both task_id and key_focus_id
- **THEN** validation fails with an error indicating exactly one reference must be set

#### Scenario: Update schema allows partial update
- **WHEN** a BlockerUpdate is instantiated with only status
- **THEN** validation passes

### Requirement: Alembic migration for blocker table
The system SHALL include an Alembic migration that creates the `blocker` table with all columns, foreign key constraints, cascade delete rules, and the CHECK constraint for XOR reference.

#### Scenario: Migration creates blocker table
- **WHEN** `alembic upgrade head` is executed
- **THEN** the `blocker` table is created with all columns and constraints

#### Scenario: Migration is reversible
- **WHEN** `alembic downgrade -1` is executed after the migration
- **THEN** the `blocker` table is dropped

### Requirement: CRUD endpoints for Blockers
The API SHALL expose RESTful endpoints under `/api/v1/blockers` for blocker management.

#### Scenario: Create a blocker for a task
- **WHEN** `POST /api/v1/blockers` is called with title and task_id
- **THEN** the blocker is created and returned with HTTP 201

#### Scenario: Create a blocker for a key focus
- **WHEN** `POST /api/v1/blockers` is called with title and key_focus_id
- **THEN** the blocker is created and returned with HTTP 201

#### Scenario: List all blockers
- **WHEN** `GET /api/v1/blockers` is called
- **THEN** all blockers are returned as a JSON array with HTTP 200

#### Scenario: List blockers filtered by status
- **WHEN** `GET /api/v1/blockers?status=opened` is called
- **THEN** only opened blockers are returned

#### Scenario: Get a blocker by ID
- **WHEN** `GET /api/v1/blockers/{id}` is called with a valid ID
- **THEN** the blocker is returned with HTTP 200

#### Scenario: Update a blocker
- **WHEN** `PATCH /api/v1/blockers/{id}` is called with `{"status": "resolved"}`
- **THEN** the blocker status is updated and returned with HTTP 200

#### Scenario: Delete a blocker
- **WHEN** `DELETE /api/v1/blockers/{id}` is called
- **THEN** the blocker is deleted and HTTP 204 is returned

### Requirement: Nested blocker endpoints on tasks
The API SHALL expose endpoints under `/api/v1/tasks/{task_id}/blockers` to list and create blockers for a specific task.

#### Scenario: List blockers for a task
- **WHEN** `GET /api/v1/tasks/{task_id}/blockers` is called
- **THEN** all blockers associated with that task are returned with HTTP 200

#### Scenario: Create blocker for a task via nested endpoint
- **WHEN** `POST /api/v1/tasks/{task_id}/blockers` is called with title
- **THEN** the blocker is created with task_id automatically set and returned with HTTP 201

### Requirement: Nested blocker endpoints on key focuses
The API SHALL expose endpoints under `/api/v1/key-focuses/{key_focus_id}/blockers` to list and create blockers for a specific key focus.

#### Scenario: List blockers for a key focus
- **WHEN** `GET /api/v1/key-focuses/{key_focus_id}/blockers` is called
- **THEN** all blockers associated with that key focus are returned with HTTP 200

#### Scenario: Create blocker for a key focus via nested endpoint
- **WHEN** `POST /api/v1/key-focuses/{key_focus_id}/blockers` is called with title
- **THEN** the blocker is created with key_focus_id automatically set and returned with HTTP 201
