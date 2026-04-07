## MODIFIED Requirements

### Requirement: Task rendering with JIRA integration
Each task card SHALL display `[<JIRA ticket id>] - <task name>`. Tasks without a JIRA ticket SHALL display only the task name. Task cards SHALL also display key focus kind badges for associated key focuses and a blocker count indicator when blockers exist.

#### Scenario: Task with JIRA ticket displayed
- **WHEN** a task with `jira_ticket_id = "JAR-123"` and `title = "Implement login"` is rendered
- **THEN** the card shows `[JAR-123] - Implement login`

#### Scenario: Task without JIRA ticket displayed
- **WHEN** a task with `jira_ticket_id = null` is rendered
- **THEN** the card shows only the task title

#### Scenario: Task with key focus badges
- **WHEN** a task associated with key focuses of kind `delivery` and `learning` is rendered
- **THEN** the card displays small colored badges for "Delivery" and "Learning"

#### Scenario: Task with blockers
- **WHEN** a task with 2 opened blockers is rendered
- **THEN** the card displays a blocker count indicator showing "2"

## ADDED Requirements

### Requirement: Blocker management button on task cards
Each task card SHALL have a blocker button (alongside the notes button) that opens a panel to view, create, and manage blockers for that task.

#### Scenario: Open blocker panel
- **WHEN** the user clicks the blocker button on a task card
- **THEN** a panel opens showing all blockers for that task

#### Scenario: Create blocker from task panel
- **WHEN** the user creates a blocker from the task's blocker panel
- **THEN** a new opened blocker is created for the task

#### Scenario: Resolve blocker from task panel
- **WHEN** the user resolves a blocker from the panel
- **THEN** the blocker status changes to resolved and the card's blocker count updates

### Requirement: Key focus association in task edit form
The task creation and edit forms SHALL include a multi-select field for associating key focuses with the task.

#### Scenario: Add key focuses during task creation
- **WHEN** the user selects two key focuses in the task creation form and saves
- **THEN** the task is created and associated with both key focuses

#### Scenario: Modify key focus associations during edit
- **WHEN** the user adds/removes key focus associations in the edit form and saves
- **THEN** the associations are updated via the API
