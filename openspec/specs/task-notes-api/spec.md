# Spec: task-notes-api

## Purpose

Defines the requirements for the task notes backend data model, Pydantic schemas, Alembic migration, and REST API endpoints for managing markdown notes attached to tasks.

## Requirements

### Requirement: TaskNote ORM model
The system SHALL define a `TaskNote` SQLAlchemy model in `app/models/task_note.py` with columns: `id` (integer, primary key, auto-increment), `task_id` (integer, foreign key to `task.id`, on delete cascade, not nullable), `content` (Text, not nullable), `created_at` (DateTime, not nullable, server default to UTC now), `updated_at` (DateTime, not nullable, server default to UTC now, updated on every modification). The model SHALL have a relationship `task` navigating to `Task`.

#### Scenario: Note created with valid task reference
- **WHEN** a TaskNote is created with `task_id = 1`, `content = "## Meeting notes\nDiscussed API design"`
- **THEN** the note is persisted with all fields set including auto-generated timestamps

#### Scenario: Note cascade-deleted when task is deleted
- **WHEN** a task with associated notes is deleted
- **THEN** all associated TaskNote rows are cascade-deleted by the database

#### Scenario: Note with empty content rejected
- **WHEN** a TaskNote is created with `content = ""`
- **THEN** the API returns HTTP 422 with a validation error

### Requirement: TaskNote Pydantic schemas
The system SHALL define Pydantic schemas in `app/schemas/task_note.py`: `TaskNoteCreate` (content: str), `TaskNoteUpdate` (content: str | None), `TaskNoteResponse` (id, task_id, content, created_at, updated_at with `from_attributes = True`).

#### Scenario: Create schema validates content
- **WHEN** a TaskNoteCreate is instantiated with `content = "Some notes"`
- **THEN** validation passes and the model is created

#### Scenario: Update schema allows partial update
- **WHEN** a TaskNoteUpdate is instantiated with no fields set
- **THEN** validation passes (all fields are optional)

### Requirement: Alembic migration for task_note table
The system SHALL include an Alembic migration that creates the `task_note` table with all columns and the foreign key constraint to `task.id` with `ON DELETE CASCADE`.

#### Scenario: Migration creates task_note table
- **WHEN** `alembic upgrade head` is executed
- **THEN** the `task_note` table is created with columns: id, task_id, content, created_at, updated_at

#### Scenario: Migration is reversible
- **WHEN** `alembic downgrade -1` is executed after the migration
- **THEN** the `task_note` table is dropped

### Requirement: CRUD endpoints for TaskNotes
The API SHALL expose RESTful endpoints under `/api/v1/tasks/{task_id}/notes` for note management. All endpoints SHALL verify the parent task exists (HTTP 404 if not).

#### Scenario: Create a note for a task
- **WHEN** `POST /api/v1/tasks/{task_id}/notes` is called with `{"content": "## Notes\nSome markdown"}`
- **THEN** the note is created and returned with HTTP 201 including id, task_id, content, and timestamps

#### Scenario: List all notes for a task
- **WHEN** `GET /api/v1/tasks/{task_id}/notes` is called
- **THEN** all notes for that task are returned ordered by `created_at` descending with HTTP 200

#### Scenario: Update a note
- **WHEN** `PATCH /api/v1/tasks/{task_id}/notes/{note_id}` is called with `{"content": "Updated content"}`
- **THEN** the note content and `updated_at` are updated and the note is returned with HTTP 200

#### Scenario: Delete a note
- **WHEN** `DELETE /api/v1/tasks/{task_id}/notes/{note_id}` is called
- **THEN** the note is deleted and HTTP 204 is returned

#### Scenario: Create note for non-existent task
- **WHEN** `POST /api/v1/tasks/999/notes` is called and task 999 does not exist
- **THEN** HTTP 404 is returned with detail "Task not found"

#### Scenario: Access note belonging to different task
- **WHEN** `GET /api/v1/tasks/1/notes/5` is called but note 5 belongs to task 2
- **THEN** HTTP 404 is returned
