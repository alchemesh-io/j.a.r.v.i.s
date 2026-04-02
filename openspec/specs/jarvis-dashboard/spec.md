# Spec: jarvis-dashboard

## Purpose

Defines the requirements for the J.A.R.V.I.S dashboard page, including metric blocks, brain animation, drag-and-drop layout, compact mode, and chat prompt section.

## Requirements

### Requirement: Dashboard header
The dashboard SHALL display a header consistent with the J.A.R.V.I.S application shell.

#### Scenario: Header rendered on dashboard
- **WHEN** the dashboard page loads
- **THEN** the application header with navigation is visible

### Requirement: Three metric blocks in horizontal layout
The dashboard SHALL display three blocks in a 3-column grid: Workers, Daily Tasks, and Weekly Tasks. Each block SHALL show color-coded metric indicators with the number above the label, both in the same color.

#### Scenario: All three blocks rendered horizontally
- **WHEN** the dashboard page loads
- **THEN** the Workers, Daily Tasks, and Weekly Tasks blocks are displayed side by side in a single row

#### Scenario: Metric display format
- **WHEN** a metric block renders its indicators
- **THEN** each metric shows the count in large bold text above the label in small uppercase, both using the same color

### Requirement: Workers block (mocked)
The Workers block SHALL display worker status metrics with color-coded indicators: grey (idle), orange (working), red (needs attention), green (done).

#### Scenario: Worker statuses displayed
- **WHEN** the dashboard renders the Workers block
- **THEN** four color-coded indicators are shown with mock counts

### Requirement: Daily Tasks block with navigation
The Daily Tasks block SHALL display metrics for the current day's tasks and include a redirect icon button (top-right, at title level) that navigates to the task board with `scope=daily` and today's date.

#### Scenario: Daily task metrics from API
- **WHEN** the dashboard loads with tasks planned for today
- **THEN** the Daily Tasks block shows correct counts per type and a total remaining count

#### Scenario: Redirect to task board
- **WHEN** the user clicks the redirect icon on the Daily Tasks block
- **THEN** the task board opens with scope set to "daily" and date set to today

### Requirement: Weekly Tasks block with navigation
The Weekly Tasks block SHALL display the same metrics as Daily Tasks but aggregated for the current week, with a redirect icon to the task board with `scope=weekly`.

#### Scenario: Redirect to weekly view
- **WHEN** the user clicks the redirect icon on the Weekly Tasks block
- **THEN** the task board opens with scope set to "weekly" and date set to today

### Requirement: Brain animation
The dashboard SHALL display an animated brain visualization using canvas with a holographic circuit pattern animation.

#### Scenario: Brain animation renders
- **WHEN** the dashboard page loads
- **THEN** the brain animation is visible and animating

### Requirement: Configurable block layout with drag-and-drop
The three metric blocks SHALL be reorderable via drag-and-drop. The layout order SHALL persist across sessions using localStorage.

#### Scenario: Block dragged to new position
- **WHEN** the user drags the Weekly Tasks block to the first position
- **THEN** the block order updates and is saved to localStorage

### Requirement: Compact mode toggle
The metric blocks SHALL support a compact mode toggled by an animated on/off pill switch. In compact mode, metric labels are hidden but block titles remain visible.

#### Scenario: Toggle compact mode
- **WHEN** the user toggles the compact switch
- **THEN** metric text labels are hidden, reducing vertical space, but card titles remain

### Requirement: Chat/Prompt section (mocked)
The dashboard SHALL display a chat/prompt input section for future agent interaction. The input SHALL be non-functional (mocked) for now.

#### Scenario: Chat input rendered
- **WHEN** the dashboard page loads
- **THEN** a text input area for chat/prompt is visible but non-functional
