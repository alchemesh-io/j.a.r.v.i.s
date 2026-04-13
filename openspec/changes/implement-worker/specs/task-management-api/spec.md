## MODIFIED Requirements

### Requirement: Task ORM model
The system SHALL define a `Task` SQLAlchemy model with columns: `id` (integer, primary key, auto-increment), `source_type` (Enum(SourceType), nullable), `source_id` (String(255), nullable), `title` (Text, not nullable), `type` (Enum(TaskType), not nullable), `status` (Enum(TaskStatus), not nullable, default `created`). It SHALL have relationships: `daily_entries` navigating to `DailyTask` with cascade delete-orphan, `notes` navigating to `TaskNote` with cascade all and delete-orphan, `worker` navigating to `Worker` (one-to-one, uselist=False).

#### Scenario: Task created with source info
- **WHEN** a task is created with `source_type = "jira"`, `source_id = "JAR-123"`, `title = "Implement login"`, `type = "implementation"`, `status = "created"`
- **THEN** the task is persisted with all fields set

#### Scenario: Task created without source info
- **WHEN** a task is created with `source_type = null` and `source_id = null`
- **THEN** the task is persisted with those fields as null

#### Scenario: Task deletion cascades to notes
- **WHEN** a task with 3 associated notes is deleted
- **THEN** all 3 TaskNote rows are cascade-deleted

#### Scenario: Task deletion cascades to worker
- **WHEN** a task with an associated worker is deleted
- **THEN** the worker record is cascade-deleted and its Kubernetes resources (pod, service, httproute) are cleaned up

#### Scenario: Task has worker relationship
- **WHEN** a task with an associated worker is retrieved
- **THEN** the `task.worker` relationship returns the Worker instance

#### Scenario: Task without worker
- **WHEN** a task without a worker is retrieved
- **THEN** the `task.worker` relationship returns `None`

### Requirement: Task response includes worker summary
The `TaskResponse` schema SHALL include a `worker` field (nullable object) containing: `id` (string), `state` (WorkerState), `effective_state` (WorkerState). When no worker exists, the field SHALL be `null`.

#### Scenario: Task with worker in response
- **WHEN** a task with an active worker is serialized
- **THEN** the response includes `"worker": { "id": "abc123", "state": "initialized", "effective_state": "working" }`

#### Scenario: Task without worker in response
- **WHEN** a task without a worker is serialized
- **THEN** the response includes `"worker": null`
