## ADDED Requirements

### Requirement: Tab-based navigation
The task board page SHALL be restructured with three clickable tab buttons on the left side of the toolbar: Tasks, Key Focuses, Reports. Each tab SHALL route to its own view while sharing the calendar and frequency selection header.

#### Scenario: Navigation tabs are visible
- **WHEN** the user loads any of the three views
- **THEN** three tab buttons (Tasks, Key Focuses, Reports) are displayed on the left side of the toolbar

#### Scenario: Active tab is highlighted
- **WHEN** the user is on the Key Focuses view
- **THEN** the Key Focuses tab button is visually highlighted as active

#### Scenario: Tab navigation updates URL
- **WHEN** the user clicks the Key Focuses tab
- **THEN** the URL updates to `/key-focuses` and the key focuses view is rendered

#### Scenario: Direct URL access works
- **WHEN** the user navigates directly to `/key-focuses`
- **THEN** the Key Focuses tab is active and the view is rendered

### Requirement: Key focus card rendering
Each key focus SHALL be rendered as a card displaying: title, description (truncated), kind badge with distinct color, status indicator, frequency badge, and associated task count.

#### Scenario: Key focus card with all fields
- **WHEN** a key focus with title, description, kind `delivery`, status `in_progress`, and 3 tasks is rendered
- **THEN** the card shows the title, truncated description, a "Delivery" badge, an in-progress indicator, and "3 tasks" count

#### Scenario: Kind badge color differentiation
- **WHEN** key focuses of all five kinds are displayed
- **THEN** each kind has a visually distinct badge color (delivery=blue, learning=green, support=purple, operational=orange, side_quest=cyan)

### Requirement: Key focus status visual indicators
Key focus cards SHALL display status using distinct visual styles: `in_progress` with an active/pulsing indicator, `succeed` with a success checkmark and green tint, `failed` with a red tint and cross icon.

#### Scenario: Succeed key focus
- **WHEN** a key focus with `status = "succeed"` is rendered
- **THEN** the card has a green success indicator and slightly dimmed appearance

#### Scenario: Failed key focus
- **WHEN** a key focus with `status = "failed"` is rendered
- **THEN** the card has a red failure indicator

### Requirement: Key focus creation form
Users SHALL be able to create a key focus with title, description, kind (dropdown), frequency (dropdown), and date context (to determine the weekly). The form SHALL appear as a modal overlay.

#### Scenario: Create a weekly key focus
- **WHEN** the user fills in the form with title, kind, frequency `weekly`, and the current date selected in the calendar
- **THEN** the key focus is created linked to the weekly containing the selected date

#### Scenario: Create a quarterly key focus
- **WHEN** the user fills in the form with frequency `quarterly`
- **THEN** the key focus is created linked to the weekly for the start of the current quarter

### Requirement: Key focus editing
Users SHALL be able to edit a key focus's title, description, kind, status, and frequency. Changes are saved on "Save" click.

#### Scenario: Update key focus status
- **WHEN** the user changes a key focus status from in_progress to succeed and clicks Save
- **THEN** the key focus status is updated via the API

### Requirement: Key focus deletion
Users SHALL be able to delete a key focus with a confirmation dialog warning about cascading deletion of blockers and task associations.

#### Scenario: Key focus deleted after confirmation
- **WHEN** the user confirms the deletion dialog
- **THEN** the key focus and all its associations are removed

### Requirement: Key focus calendar and frequency selection
The key focus view SHALL reuse the same calendar component and add a frequency selector (weekly/quarterly) in the toolbar to filter key focuses.

#### Scenario: Weekly frequency selected
- **WHEN** the user selects weekly frequency
- **THEN** only weekly key focuses for the selected week are displayed

#### Scenario: Quarterly frequency selected
- **WHEN** the user selects quarterly frequency
- **THEN** quarterly key focuses for the quarter containing the selected date are displayed

### Requirement: Blocker management on key focus cards
Each key focus card SHALL have a blocker button (similar to the notes button on task cards) that opens a panel to view, create, and manage blockers.

#### Scenario: View blockers for a key focus
- **WHEN** the user clicks the blocker button on a key focus card
- **THEN** a panel opens showing all blockers for that key focus

#### Scenario: Create a blocker from the panel
- **WHEN** the user fills in a blocker title and submits
- **THEN** a new opened blocker is created for the key focus

#### Scenario: Resolve a blocker
- **WHEN** the user clicks the resolve button on an opened blocker
- **THEN** the blocker status is updated to resolved
