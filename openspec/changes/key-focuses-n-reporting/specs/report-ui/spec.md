## ADDED Requirements

### Requirement: Reports view rendering
The Reports view SHALL display aggregated progress data for the selected time period, including task completion metrics, key focus status summary, and blocker overview.

#### Scenario: Weekly report displayed
- **WHEN** the user navigates to the Reports tab with a week selected
- **THEN** the view shows task completion counts, key focus statuses, and blocker counts for that week

#### Scenario: Empty state when no data
- **WHEN** the user navigates to Reports for a week with no tasks or key focuses
- **THEN** an empty state message is displayed

### Requirement: Task completion summary
The reports view SHALL display a task completion summary showing: total tasks, completed tasks, completion percentage, and breakdown by task type.

#### Scenario: Task metrics displayed
- **WHEN** a week has 10 tasks with 7 completed
- **THEN** the report shows "7/10 tasks completed (70%)" with a breakdown by type

### Requirement: Key focus status summary
The reports view SHALL display a key focus status summary showing: total key focuses, count per status (in_progress, succeed, failed), and breakdown by kind.

#### Scenario: Key focus metrics displayed
- **WHEN** a week has 5 key focuses (3 in_progress, 1 succeed, 1 failed)
- **THEN** the report shows the status distribution and kind breakdown

### Requirement: Blocker overview
The reports view SHALL display a blocker summary showing: total blockers, opened count, resolved count.

#### Scenario: Blocker metrics displayed
- **WHEN** a week has 4 blockers (2 opened, 2 resolved)
- **THEN** the report shows "2 opened, 2 resolved out of 4 total"

### Requirement: Reports calendar and scope reuse
The reports view SHALL reuse the same calendar component and scope selector from the task board, using the selected date/scope to determine the reporting period.

#### Scenario: Scope change updates report
- **WHEN** the user changes scope from weekly to daily
- **THEN** the report updates to show metrics for just the selected day
