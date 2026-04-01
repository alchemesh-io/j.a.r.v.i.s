## ADDED Requirements

### Requirement: Task rendering with JIRA integration
Each task card SHALL display `[<JIRA ticket id>] - <task name>`. Tasks without a JIRA ticket SHALL display only the task name.

#### Scenario: Task with JIRA ticket displayed
- **WHEN** a task with `jira_ticket_id = "JAR-123"` and `title = "Implement login"` is rendered
- **THEN** the card shows `[JAR-123] - Implement login`

#### Scenario: Task without JIRA ticket displayed
- **WHEN** a task with `jira_ticket_id = null` is rendered
- **THEN** the card shows only the task title

### Requirement: Task type color differentiation
Each task card SHALL use a distinct gradient background and type badge based on task type: blue for `refinement`, orange for `implementation`, red for `review`.

#### Scenario: Tasks visually distinguishable by type
- **WHEN** tasks of all three types are displayed on the board
- **THEN** each type has a visually distinct gradient and colored type badge at the bottom-right of the card

### Requirement: Task dates displayed on cards
Each task card SHALL display the dates it is associated with as small date chips, positioned above the type badge.

#### Scenario: Task with multiple dates
- **WHEN** a task associated with March 28 and March 29 is rendered
- **THEN** the card shows "Mar 28" and "Mar 29" chips above the type badge

### Requirement: Done tasks are visually dimmed
Tasks with `status = "done"` SHALL be visually dimmed with strikethrough title.

#### Scenario: Completed task appears dimmed
- **WHEN** a task with `status = "done"` is rendered
- **THEN** the task card has reduced opacity and the title has a strikethrough

### Requirement: Toggle task status from card
Each task card SHALL have a check/undo button (top-right) to toggle between `created` and `done` status directly.

#### Scenario: Mark task as done
- **WHEN** the user clicks the check button on an active task
- **THEN** the task status is updated to `done` via the API

#### Scenario: Reopen a done task
- **WHEN** the user clicks the undo button on a done task
- **THEN** the task status is updated to `created` via the API

### Requirement: Done task visibility toggle
The task board toolbar SHALL include an animated toggle button to switch between "dim" (default) and "hide" modes for done tasks. The setting SHALL persist to localStorage.

#### Scenario: Dim mode (default)
- **WHEN** the toggle is in the "on" position
- **THEN** done tasks are displayed with reduced opacity

#### Scenario: Hide mode
- **WHEN** the toggle is in the "off" position
- **THEN** done tasks are filtered out of the grid entirely

### Requirement: Task deletion
Users SHALL be able to delete a task from the board.

#### Scenario: Task deleted from board
- **WHEN** the user triggers the delete action on a task
- **THEN** the task is removed from the backend and disappears from the board

### Requirement: Drag-and-drop task reordering
Tasks SHALL be reorderable via drag-and-drop in a card grid layout. The drag handle is the card content area; action buttons are outside the drag zone.

#### Scenario: Task dragged to new position
- **WHEN** the user drags a task card to a new position
- **THEN** all task priorities are updated via the batch reorder API

### Requirement: Task creation with date support
Users SHALL be able to create a task with title, JIRA ticket ID, type, and one or multiple dates. A "+ Today" button SHALL add today's date to the selection.

#### Scenario: Task created with dates
- **WHEN** the user fills in the creation form with title, type, and selected dates
- **THEN** the task is created and associated with dailies for all selected dates

#### Scenario: JIRA ticket ID extraction
- **WHEN** the user provides a JIRA ticket URL or ID
- **THEN** only the ticket ID (e.g., `JAR-123`) is extracted and stored

### Requirement: Task editing with date management
Users SHALL be able to edit a task's details including adding/removing date associations. Changes are saved on "Save" click (not immediately).

#### Scenario: Add date during edit
- **WHEN** the user adds a new date in the edit form and clicks Save
- **THEN** the task is associated with the new daily

#### Scenario: Remove date during edit
- **WHEN** the user removes a date in the edit form and clicks Save
- **THEN** the task is disassociated from that daily

### Requirement: Task creation/edit form as overlay
The form SHALL appear as a modal overlay on top of the task grid with a blurred backdrop. When editing, the form SHALL have a colored top border matching the task type.

#### Scenario: Edit form shows task type color
- **WHEN** the user edits an implementation task
- **THEN** the form has an orange top border and gradient

### Requirement: Calendar navigation
A month-view calendar component SHALL be displayed in the left sidebar below the create button. Today is shown with a filled cyan circle; the selected date with a border outline.

#### Scenario: Default date is today
- **WHEN** the task board loads
- **THEN** the calendar highlights today and shows tasks for the date stored in localStorage (or today)

### Requirement: Time scope filter
A dropdown in the toolbar SHALL allow selecting the time scope: `daily`, `weekly`, or `all`. The setting SHALL persist to localStorage.

#### Scenario: Scope persisted across sessions
- **WHEN** the user selects "Week" scope and reloads the page
- **THEN** the scope dropdown shows "Week"

### Requirement: Task ordering by type
Tasks SHALL be sorted by type: review first, then implementation, then refinement.

#### Scenario: Tasks ordered on the board
- **WHEN** the board displays tasks
- **THEN** review tasks appear first, followed by implementation, then refinement

### Requirement: All filters persisted to localStorage
Selected date, scope, and done-task visibility mode SHALL be saved to localStorage and restored on page load.

#### Scenario: Filters restored on reload
- **WHEN** the user reloads the task board
- **THEN** the previously selected date, scope, and done toggle state are restored
