## MODIFIED Requirements

### Requirement: Task ORM model
The system SHALL define a `Task` SQLAlchemy model with columns: `id` (integer, primary key, auto-increment), `source_type` (Enum(SourceType), nullable), `source_id` (String(255), nullable), `title` (Text, not nullable), `type` (Enum(TaskType), not nullable), `status` (Enum(TaskStatus), not nullable, default `created`). It SHALL have relationships: `daily_entries` navigating to `DailyTask` with cascade delete-orphan, `notes` navigating to `TaskNote` with cascade all and delete-orphan.

#### Scenario: Task created with source info
- **WHEN** a task is created with `source_type = "jira"`, `source_id = "JAR-123"`, `title = "Implement login"`, `type = "implementation"`, `status = "created"`
- **THEN** the task is persisted with all fields set

#### Scenario: Task created without source info
- **WHEN** a task is created with `source_type = null` and `source_id = null`
- **THEN** the task is persisted with those fields as null

#### Scenario: Task deletion cascades to notes
- **WHEN** a task with 3 associated notes is deleted
- **THEN** all 3 TaskNote rows are cascade-deleted

### Requirement: Task response includes note count
The `TaskResponse` schema SHALL include a `note_count` field (integer) representing the number of notes attached to the task.

#### Scenario: Task with notes
- **WHEN** a task with 5 notes is retrieved
- **THEN** the response includes `"note_count": 5`

#### Scenario: Task without notes
- **WHEN** a task with no notes is retrieved
- **THEN** the response includes `"note_count": 0`
