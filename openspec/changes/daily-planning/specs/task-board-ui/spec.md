## ADDED Requirements

### Requirement: Task rendering with JIRA integration
Each task card SHALL display `[<JIRA ticket id>] - <task name>`. A clickable JIRA icon (sourced from `https://cdn.worldvectorlogo.com/logos/jira-1.svg`) SHALL link to the JIRA ticket. Tasks without a JIRA ticket SHALL display only the task name.

#### Scenario: Task with JIRA ticket displayed
- **WHEN** a task with `jira_ticket_id = "JAR-123"` and `title = "Implement login"` is rendered
- **THEN** the card shows `[JAR-123] - Implement login` with a clickable JIRA icon

#### Scenario: Task without JIRA ticket displayed
- **WHEN** a task with `jira_ticket_id = null` is rendered
- **THEN** the card shows only the task title with no JIRA icon

### Requirement: Task type color differentiation
Each task card SHALL use a distinct color based on task type: one color for `refinement`, a different color for `implementation`, and a third for `review`.

#### Scenario: Tasks visually distinguishable by type
- **WHEN** tasks of all three types are displayed on the board
- **THEN** each type has a visually distinct color that is identifiable at a glance

### Requirement: Done tasks are visually dimmed
Tasks with `status = "done"` SHALL be visually dimmed compared to active tasks.

#### Scenario: Completed task appears dimmed
- **WHEN** a task with `status = "done"` is rendered
- **THEN** the task card has reduced opacity or a muted color treatment

### Requirement: Task deletion
Users SHALL be able to delete a task from the board.

#### Scenario: Task deleted from board
- **WHEN** the user triggers the delete action on a task
- **THEN** the task is removed from the backend and disappears from the board

### Requirement: Drag-and-drop task reordering
Tasks within a group SHALL be reorderable via drag-and-drop. During drag, a placeholder SHALL animate into the target position before the drop. Dropping SHALL update the priority of all affected tasks via the batch reorder API.

#### Scenario: Task dragged to new position
- **WHEN** the user drags a task from priority 3 to priority 1 within the same group
- **THEN** a placeholder appears at position 1, and on drop, all task priorities are updated

#### Scenario: Drag-and-drop is keyboard accessible
- **WHEN** the user navigates to a task using keyboard and activates drag mode
- **THEN** they can reorder the task using arrow keys and confirm with Enter

### Requirement: Task creation
Users SHALL be able to create a task by providing a JIRA ticket link (only the ticket ID is stored), a title, a task type, and one or multiple dates.

#### Scenario: Task created with single date
- **WHEN** the user fills in the creation form with title, type, and one date
- **THEN** the task is created and associated with the daily for that date

#### Scenario: Task created with multiple dates
- **WHEN** the user fills in the creation form with title, type, and three dates
- **THEN** the task is created and associated with dailies for all three dates

#### Scenario: Task created with JIRA ticket link
- **WHEN** the user provides a JIRA ticket URL or ID in the creation form
- **THEN** only the ticket ID (e.g., `JAR-123`) is extracted and stored

### Requirement: Task editing
Users SHALL be able to edit a task's details. The edit form SHALL include a shortcut to add the current date to the task's planning ("Add to today's planning").

#### Scenario: Task title edited
- **WHEN** the user edits a task's title and saves
- **THEN** the updated title is persisted and reflected on the board

#### Scenario: Add to today's planning shortcut
- **WHEN** the user clicks "Add to today's planning" while editing a task
- **THEN** today's date is added to the task's daily associations

### Requirement: Calendar navigation
A month-view calendar component (inspired by Google Calendar's mini-calendar) SHALL be displayed on the left side of the task board. Users SHALL navigate between months and years. The currently selected date defaults to today.

#### Scenario: Default date is today
- **WHEN** the task board loads
- **THEN** the calendar highlights today's date and the board shows tasks for today

#### Scenario: Navigate to a different month
- **WHEN** the user clicks the next-month arrow
- **THEN** the calendar displays the following month

#### Scenario: Select a specific date
- **WHEN** the user clicks on April 5 in the calendar
- **THEN** the selected date changes to April 5 and the task list updates accordingly

### Requirement: Time scope filter
A dropdown above the task list SHALL allow selecting the time scope: `daily`, `weekly`, or `all`. The combination of the selected calendar date and the time scope determines which tasks are displayed.

#### Scenario: Daily scope with selected date
- **WHEN** the scope is `daily` and the selected date is 2026-04-02
- **THEN** only tasks associated with 2026-04-02 are shown

#### Scenario: Weekly scope with selected date
- **WHEN** the scope is `weekly` and the selected date is Thursday 2026-04-02
- **THEN** tasks from Sunday 2026-03-29 through Saturday 2026-04-04 are shown

#### Scenario: All scope ignores date
- **WHEN** the scope is `all`
- **THEN** all tasks are shown regardless of daily association

### Requirement: Task grouping by type
Tasks on the board SHALL be grouped by type: `refinement`, `implementation`, `review`. Within each group, tasks SHALL be ordered by priority.

#### Scenario: Tasks grouped and ordered
- **WHEN** the board displays tasks
- **THEN** tasks are visually separated into three groups by type, and within each group ordered by ascending priority
