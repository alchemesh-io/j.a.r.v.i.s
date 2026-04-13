## MODIFIED Requirements

### Requirement: Task rendering with JIRA integration
Each task card SHALL display `[<JIRA ticket id>] - <task name>`. Tasks without a JIRA ticket SHALL display only the task name. Each task card SHALL also display a worker status indicator when a worker exists for the task, a play button when no worker exists, and a VSCode icon when an active worker exists.

#### Scenario: Task with JIRA ticket displayed
- **WHEN** a task with `jira_ticket_id = "JAR-123"` and `title = "Implement login"` is rendered
- **THEN** the card shows `[JAR-123] - Implement login`

#### Scenario: Task without JIRA ticket displayed
- **WHEN** a task with `jira_ticket_id = null` is rendered
- **THEN** the card shows only the task title

#### Scenario: Task with active worker displayed
- **WHEN** a task with a worker in `working` state is rendered
- **THEN** the card shows a green worker status indicator and a VSCode icon, but no play button

#### Scenario: Task without worker displayed
- **WHEN** a task with no worker is rendered
- **THEN** the card shows a play button but no worker status indicator or VSCode icon
