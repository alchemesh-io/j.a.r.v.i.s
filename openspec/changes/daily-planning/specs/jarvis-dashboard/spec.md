## ADDED Requirements

### Requirement: Dashboard header
The dashboard SHALL display a header consistent with the J.A.R.V.I.S application shell.

#### Scenario: Header rendered on dashboard
- **WHEN** the dashboard page loads
- **THEN** the application header with navigation is visible

### Requirement: Three metric blocks
The dashboard SHALL display three blocks: Workers, Daily Tasks, and Weekly Tasks. Each block SHALL show color-coded metric indicators.

#### Scenario: All three blocks rendered
- **WHEN** the dashboard page loads
- **THEN** the Workers, Daily Tasks, and Weekly Tasks blocks are all visible

### Requirement: Workers block (mocked)
The Workers block SHALL display worker status metrics with color-coded indicators: black (idle), orange (working), red (needs attention), green (done). The data SHALL be mocked for now.

#### Scenario: Worker statuses displayed
- **WHEN** the dashboard renders the Workers block
- **THEN** four color-coded indicators are shown with mock counts for idle, working, needs attention, and done

### Requirement: Daily Tasks block
The Daily Tasks block SHALL display metrics for the current day's tasks: blue (refinement count), orange (implementation count), red (review count), black (remaining/not-done count).

#### Scenario: Daily task metrics from API
- **WHEN** the dashboard loads with tasks planned for today
- **THEN** the Daily Tasks block shows correct counts per type and a total remaining count

#### Scenario: No tasks for today
- **WHEN** no tasks are associated with today's date
- **THEN** the Daily Tasks block shows zero for all counts

### Requirement: Weekly Tasks block
The Weekly Tasks block SHALL display the same metrics as Daily Tasks but aggregated for the current week (Sunday through Saturday).

#### Scenario: Weekly task metrics aggregated
- **WHEN** the dashboard loads with tasks planned across the current week
- **THEN** the Weekly Tasks block shows aggregated counts per type and total remaining

### Requirement: Brain animation
The dashboard SHALL display an animated brain visualization following the style of the J.A.R.V.I.S live wallpaper (holographic/circuit pattern animation).

#### Scenario: Brain animation renders
- **WHEN** the dashboard page loads
- **THEN** the brain animation is visible and animating

### Requirement: Configurable block layout with drag-and-drop
The three metric blocks SHALL be reorderable via drag-and-drop. The layout order SHALL persist across sessions using localStorage.

#### Scenario: Block dragged to new position
- **WHEN** the user drags the Weekly Tasks block to the first position
- **THEN** the block order updates and is saved to localStorage

#### Scenario: Layout restored on reload
- **WHEN** the user reloads the dashboard after reordering blocks
- **THEN** the blocks appear in the previously saved order

### Requirement: Compact mode for metric blocks
The metric blocks SHALL support a compact/reduced mode where text labels are hidden and block titles are replaced by icons only.

#### Scenario: Toggle compact mode
- **WHEN** the user activates compact mode
- **THEN** block titles become icons and metric text labels are hidden, reducing vertical space

### Requirement: Chat/Prompt section (mocked)
The dashboard SHALL display a chat/prompt input section for future agent interaction. The input SHALL be non-functional (mocked) for now.

#### Scenario: Chat input rendered
- **WHEN** the dashboard page loads
- **THEN** a text input area for chat/prompt is visible but non-functional
