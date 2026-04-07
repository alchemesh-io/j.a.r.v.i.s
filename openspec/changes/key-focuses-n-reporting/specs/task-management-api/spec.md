## MODIFIED Requirements

### Requirement: Task ORM model
The system SHALL define a `Task` SQLAlchemy model with columns: `id` (integer, primary key, auto-increment), `source_type` (Enum(SourceType), nullable), `source_id` (String(255), nullable), `title` (Text, not nullable), `type` (Enum(TaskType), not nullable), `status` (Enum(TaskStatus), not nullable, default `created`). It SHALL have relationships: `daily_entries` navigating to `DailyTask` with cascade delete-orphan, `notes` navigating to `TaskNote` with cascade all and delete-orphan, `key_focuses` navigating to `KeyFocus` via `TaskKeyFocus`, `blockers` navigating to `Blocker`.

#### Scenario: Task created with source info
- **WHEN** a task is created with `source_type = "jira"`, `source_id = "JAR-123"`, `title = "Implement login"`, `type = "implementation"`, `status = "created"`
- **THEN** the task is persisted with all fields set

#### Scenario: Task created without source info
- **WHEN** a task is created with `source_type = null` and `source_id = null`
- **THEN** the task is persisted with those fields as null

#### Scenario: Task deletion cascades to notes
- **WHEN** a task with 3 associated notes is deleted
- **THEN** all 3 TaskNote rows are cascade-deleted

#### Scenario: Task deletion cascades to key focus associations
- **WHEN** a task with 2 key focus associations is deleted
- **THEN** all TaskKeyFocus rows for that task are cascade-deleted

#### Scenario: Task deletion cascades to blockers
- **WHEN** a task with associated blockers is deleted
- **THEN** all Blocker rows linked to that task are cascade-deleted

### Requirement: Task response includes associated dates
The `TaskResponse` schema SHALL include a `dates` field containing a sorted list of dates the task is associated with, derived from the `daily_entries` relationship.

#### Scenario: Task with daily associations
- **WHEN** a task associated with 2026-03-28 and 2026-03-29 is retrieved
- **THEN** the response includes `"dates": ["2026-03-28", "2026-03-29"]`

#### Scenario: Task with no associations
- **WHEN** a task with no daily associations is retrieved
- **THEN** the response includes `"dates": []`

### Requirement: Task response includes note count
The `TaskResponse` schema SHALL include a `note_count` field (integer) representing the number of notes attached to the task.

#### Scenario: Task with notes
- **WHEN** a task with 5 notes is retrieved
- **THEN** the response includes `"note_count": 5`

#### Scenario: Task without notes
- **WHEN** a task with no notes is retrieved
- **THEN** the response includes `"note_count": 0`

## ADDED Requirements

### Requirement: Task response includes key focus data
The `TaskResponse` schema SHALL include a `key_focuses` field containing a list of associated key focus summaries (id, title, kind) and a `blocker_count` field (integer).

#### Scenario: Task with key focuses
- **WHEN** a task associated with 2 key focuses is retrieved
- **THEN** the response includes `"key_focuses": [{"id": 1, "title": "...", "kind": "delivery"}, ...]` and the appropriate blocker_count

#### Scenario: Task without key focuses
- **WHEN** a task with no key focus associations is retrieved
- **THEN** the response includes `"key_focuses": []` and `"blocker_count": 0`

### Requirement: Key focus management endpoints on tasks
The API SHALL expose endpoints under `/api/v1/tasks/{task_id}/key-focuses` to view and manage key focus associations for a task.

#### Scenario: List key focuses for a task
- **WHEN** `GET /api/v1/tasks/{task_id}/key-focuses` is called
- **THEN** all key focuses associated with that task are returned with HTTP 200

#### Scenario: Add key focus to a task
- **WHEN** `POST /api/v1/tasks/{task_id}/key-focuses` is called with `{"key_focus_id": 1}`
- **THEN** the association is created and returned with HTTP 201

#### Scenario: Remove key focus from a task
- **WHEN** `DELETE /api/v1/tasks/{task_id}/key-focuses/{key_focus_id}` is called
- **THEN** the association is removed with HTTP 204
