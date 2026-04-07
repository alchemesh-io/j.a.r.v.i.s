## MODIFIED Requirements

### Requirement: Task deletion
Users SHALL be able to delete a task from the board. Deletion SHALL require a confirmation dialog that warns about cascading note deletion.

#### Scenario: Task deleted after confirmation
- **WHEN** the user triggers the delete action on a task
- **THEN** a confirmation dialog appears warning that the task and all its notes will be permanently deleted

#### Scenario: Task deletion confirmed
- **WHEN** the user confirms the deletion dialog
- **THEN** the task is removed from the backend and disappears from the board

#### Scenario: Task deletion cancelled
- **WHEN** the user cancels the deletion dialog
- **THEN** the task remains unchanged on the board
