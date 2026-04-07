# Spec: taskboard-ui

## Purpose

Defines the requirements for the TaskBoard page UI controls and styling, including the sticky toolbar, scope tabs, calendar dropdown, create button, done toggle, and empty state.

## Requirements

### Requirement: TaskBoard toolbar is sticky with HUD styling
The TaskBoard toolbar row (containing Create, date picker, scope tabs, and Done toggle) SHALL be `position: sticky; top: 0` with a dark glass background and a bottom cyan border, so it remains visible when the task list is scrolled.

#### Scenario: Toolbar stays visible on scroll
- **WHEN** the user scrolls down through a long task list
- **THEN** the toolbar remains pinned to the top of the viewport below the app header

#### Scenario: Toolbar glass background
- **WHEN** the TaskBoard is rendered
- **THEN** the toolbar has `background: rgba(11,14,26,0.9)`, `backdrop-filter: blur(14px)`, and `border-bottom: 1px solid rgba(0,212,255,0.12)`

### Requirement: Scope selector is rendered as HUD tab group
The Day / Week / All scope selector SHALL be rendered as a row of pill-style tab buttons inside a dark glass container, replacing the native `<select>` dropdown.

#### Scenario: Scope tabs visible
- **WHEN** the TaskBoard renders
- **THEN** three tab buttons (DAY, WEEK, ALL) are visible in the toolbar right section

#### Scenario: Active scope highlighted
- **WHEN** the user selects a scope tab
- **THEN** the active tab has `color: var(--jads-color-accent-cyan)`, a cyan-tinted background, and a `box-shadow` glow

#### Scenario: Inactive tabs muted
- **WHEN** the scope tab is not active
- **THEN** it displays in `var(--jads-color-text-muted)` with no background

### Requirement: Calendar is accessible via a date dropdown button
The calendar component SHALL not be rendered permanently in a sidebar. Instead, a date button SHALL show the selected date and, on click, open a floating calendar panel positioned below the button.

#### Scenario: Calendar opens on date button click
- **WHEN** the user clicks the date button in the toolbar
- **THEN** a floating calendar panel appears below the button with a glass dark background

#### Scenario: Calendar closes on date selection
- **WHEN** the user selects a date from the calendar panel
- **THEN** the panel closes and the date button updates to display the new date

#### Scenario: Calendar closes on outside click
- **WHEN** the calendar panel is open and the user clicks outside of it
- **THEN** the panel closes

### Requirement: Create button uses a HUD ghost style
The "+ Create" button in the toolbar SHALL use a ghost HUD style: transparent background, `1px solid rgba(0,212,255,0.3)` border, cyan text, uppercase small caps.

#### Scenario: Create button style
- **WHEN** the TaskBoard renders
- **THEN** the Create button has a cyan outline ghost appearance matching the scope tabs container

### Requirement: Done toggle uses a HUD pill button style
The Done toggle SHALL be a text button styled identically to the scope tabs (dark glass, cyan when active), replacing the iOS-style pill toggle.

#### Scenario: Done active state
- **WHEN** `doneMode` is `'dim'` (done tasks visible)
- **THEN** the DONE button displays in cyan with a glow, identical to an active scope tab

#### Scenario: Done inactive state
- **WHEN** `doneMode` is `'hide'`
- **THEN** the DONE button displays in muted grey

### Requirement: Empty state uses a HUD radar component
When no tasks exist for the current selection, the TaskBoard SHALL display an `EmptyState` component with a radar-sweep SVG animation, a context-sensitive title, and a subtitle.

#### Scenario: Empty state shown when no tasks
- **WHEN** `visibleTasks.length === 0`
- **THEN** the `EmptyState` component renders in place of the task grid

#### Scenario: Empty state message is scope-aware
- **WHEN** the empty state renders in `daily` scope
- **THEN** the title reads "No tasks scheduled" and the subtitle "Nothing assigned for this day."
- **WHEN** the empty state renders in `weekly` scope
- **THEN** the title reads "Clear week ahead" and the subtitle "No tasks found for this week."
- **WHEN** the empty state renders in `all` scope
- **THEN** the title reads "Task board is empty" and the subtitle "Start by creating your first task."

#### Scenario: Radar sweep animates
- **WHEN** the empty state is visible
- **THEN** a radial sweep line rotates 360° continuously on the SVG radar graphic

#### Scenario: Empty state entrance animation
- **WHEN** the empty state first renders
- **THEN** it fades in and slides up via a CSS `animation` over 0.5s
