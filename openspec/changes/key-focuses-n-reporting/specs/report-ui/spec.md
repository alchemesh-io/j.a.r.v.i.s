## ADDED Requirements

### Requirement: Reports view with dual scope
The Reports view SHALL operate in two modes based on the scope selector: **weekly** and **daily**. Each mode displays a structured recap comparing the previous period with the current one.

#### Scenario: Weekly scope selected
- **WHEN** the user navigates to Reports with weekly scope and a week selected
- **THEN** the view displays four sections: previous week key focuses done, previous week key focuses not done, remaining blockers from previous week key focuses, and current week key focuses

#### Scenario: Daily scope selected
- **WHEN** the user navigates to Reports with daily scope and a date selected
- **THEN** the view displays four sections: previous day tasks done, previous day tasks not done, remaining blockers from previous day tasks, and current day tasks

#### Scenario: Empty state when no data
- **WHEN** the user navigates to Reports for a period with no tasks or key focuses in either current or previous period
- **THEN** an empty state message is displayed

### Requirement: Weekly report — previous week key focuses done
The weekly report SHALL display a section listing all key focuses from the previous week that have `status = "succeed"`, showing their title, kind badge, and description.

#### Scenario: Previous week has succeeded key focuses
- **WHEN** the previous week has 3 key focuses with status `succeed`
- **THEN** the section lists all 3 with their details and a success visual indicator

#### Scenario: No succeeded key focuses in previous week
- **WHEN** the previous week has no key focuses with status `succeed`
- **THEN** the section shows an empty state like "No key focuses completed"

### Requirement: Weekly report — previous week key focuses not done
The weekly report SHALL display a section listing all key focuses from the previous week that have `status = "in_progress"` or `status = "failed"`, showing their title, kind badge, status, and description.

#### Scenario: Previous week has incomplete key focuses
- **WHEN** the previous week has 2 key focuses still in_progress and 1 failed
- **THEN** the section lists all 3 with their current status clearly indicated

### Requirement: Weekly report — remaining blockers from previous week
The weekly report SHALL display a section listing all blockers with `status = "opened"` that are associated with key focuses from the previous week.

#### Scenario: Previous week has unresolved blockers
- **WHEN** the previous week's key focuses have 2 opened blockers
- **THEN** the section lists both blockers with their title and the key focus they belong to

#### Scenario: No remaining blockers
- **WHEN** all blockers from previous week key focuses are resolved
- **THEN** the section shows an empty state like "No remaining blockers"

### Requirement: Weekly report — current week key focuses
The weekly report SHALL display a section listing all key focuses for the currently selected week, showing their title, kind badge, status, and description.

#### Scenario: Current week has key focuses
- **WHEN** the selected week has 4 key focuses
- **THEN** the section lists all 4 with their details and current status

### Requirement: Daily report — previous day tasks done
The daily report SHALL display a section listing all tasks from the previous day that have `status = "done"`, showing their title, type badge, and key focus associations.

#### Scenario: Previous day has completed tasks
- **WHEN** the previous day has 5 tasks with status `done`
- **THEN** the section lists all 5 with their details and a completion indicator

#### Scenario: No completed tasks in previous day
- **WHEN** the previous day has no tasks with status `done`
- **THEN** the section shows an empty state like "No tasks completed"

### Requirement: Daily report — previous day tasks not done
The daily report SHALL display a section listing all tasks from the previous day that have `status = "created"` (not done), showing their title, type badge, and key focus associations.

#### Scenario: Previous day has incomplete tasks
- **WHEN** the previous day has 3 tasks still with status `created`
- **THEN** the section lists all 3 with their current status

### Requirement: Daily report — remaining blockers from previous day
The daily report SHALL display a section listing all blockers with `status = "opened"` that are associated with tasks from the previous day.

#### Scenario: Previous day has unresolved blockers
- **WHEN** the previous day's tasks have 1 opened blocker
- **THEN** the section lists the blocker with its title and the task it belongs to

### Requirement: Daily report — current day tasks
The daily report SHALL display a section listing all tasks for the currently selected day, showing their title, type badge, status, and key focus associations.

#### Scenario: Current day has tasks
- **WHEN** the selected day has 6 tasks
- **THEN** the section lists all 6 with their details and current status

### Requirement: Reports calendar and scope reuse
The reports view SHALL reuse the same calendar component and scope selector from the task board. The scope selector SHALL offer daily and weekly options. The selected date determines the current period, and the previous period is automatically derived (previous day or previous week).

#### Scenario: Scope change updates report structure
- **WHEN** the user changes scope from weekly to daily
- **THEN** the report switches from key-focus-based sections to task-based sections

#### Scenario: Date change updates both periods
- **WHEN** the user selects a different date in the calendar
- **THEN** both current and previous period data are refreshed
