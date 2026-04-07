# Spec: task-notes-ui

## Purpose

Defines the requirements for the task board UI additions for viewing, creating, editing, and deleting notes with markdown rendering.

## Requirements

### Requirement: Notes button on task cards
Each task card SHALL display a notes button (document/note icon) that opens the notes panel for that task. The button SHALL show the note count if the task has notes.

#### Scenario: Task with notes shows count
- **WHEN** a task with 3 notes is rendered on the board
- **THEN** the notes button displays a badge with "3"

#### Scenario: Task without notes shows icon only
- **WHEN** a task with 0 notes is rendered
- **THEN** the notes button shows just the icon with no badge

### Requirement: Notes panel overlay
Clicking the notes button SHALL open a panel overlay displaying all notes for the selected task. The panel SHALL have a header showing the task title and a close button.

#### Scenario: Notes panel opens with task context
- **WHEN** the user clicks the notes button on a task titled "Implement login"
- **THEN** a panel opens with header "Notes — Implement login" and lists all notes

#### Scenario: Notes panel closes
- **WHEN** the user clicks the close button or presses Escape
- **THEN** the panel closes and focus returns to the task board

### Requirement: Markdown rendering for notes
Each note in the panel SHALL render its markdown content using a markdown renderer in read mode. Supported syntax SHALL include headings, bold, italic, code blocks, lists, links, and GFM tables/checkboxes.

#### Scenario: Markdown rendered correctly
- **WHEN** a note with content `"## Title\n- item 1\n- item 2\n\n**bold** text"` is displayed
- **THEN** the content is rendered as an H2 heading, a bullet list, and bold text

#### Scenario: Code blocks rendered with syntax highlighting
- **WHEN** a note contains a fenced code block
- **THEN** the code is displayed in a monospace font within a styled code block

### Requirement: Create new note
The notes panel SHALL include a text area at the top for writing a new note and a "Save" button. The text area SHALL support markdown input.

#### Scenario: New note created successfully
- **WHEN** the user types markdown content and clicks "Save"
- **THEN** the note is created via the API and appears in the notes list

#### Scenario: Empty note submission prevented
- **WHEN** the user clicks "Save" with an empty text area
- **THEN** the save button is disabled or the submission is prevented

### Requirement: Edit existing note
Each note SHALL have an edit button that switches the note from rendered markdown to a text area for editing. A "Save" button commits the changes; a "Cancel" button discards them.

#### Scenario: Note edited and saved
- **WHEN** the user clicks edit, modifies the content, and clicks Save
- **THEN** the note is updated via the API and re-rendered with new content

#### Scenario: Edit cancelled
- **WHEN** the user clicks edit, modifies content, and clicks Cancel
- **THEN** the note reverts to its previous content in read mode

### Requirement: Delete individual note
Each note SHALL have a delete button. Clicking it SHALL show a confirmation prompt before deleting.

#### Scenario: Note deleted after confirmation
- **WHEN** the user clicks delete on a note and confirms
- **THEN** the note is removed via the API and disappears from the list

#### Scenario: Note deletion cancelled
- **WHEN** the user clicks delete and cancels the confirmation
- **THEN** the note remains unchanged

### Requirement: Task deletion confirmation
Deleting a task from the task board SHALL show a confirmation dialog warning that all associated notes will also be deleted.

#### Scenario: Task deleted after confirmation
- **WHEN** the user triggers delete on a task and confirms the dialog
- **THEN** the task and all its notes are deleted via the API

#### Scenario: Task deletion cancelled
- **WHEN** the user triggers delete on a task and cancels the dialog
- **THEN** the task remains unchanged
