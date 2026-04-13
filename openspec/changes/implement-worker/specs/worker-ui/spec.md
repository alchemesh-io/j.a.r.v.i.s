## ADDED Requirements

### Requirement: Workers page in frontend navigation
The frontend SHALL include a "Workers" link in the main navigation header and a `/workers` route rendering the Workers management page.

#### Scenario: Workers page accessible via navigation
- **WHEN** the user clicks the "Workers" link in the header
- **THEN** the browser navigates to `/workers` and the Workers page is rendered

### Requirement: Workers page layout
The Workers page SHALL have two sections: a repository management panel and a worker list. The layout SHALL follow the card-based pattern used by tasks and key focuses.

#### Scenario: Page renders both sections
- **WHEN** the Workers page loads
- **THEN** both the repository management panel and the worker card grid are visible

### Requirement: Repository management panel
The Workers page SHALL include a collapsible panel for managing repositories. Users SHALL be able to add a new repository (git URL + branch), view all repositories, and delete a repository.

#### Scenario: Add a new repository
- **WHEN** the user enters a git URL and branch and clicks "Add"
- **THEN** `POST /api/v1/repositories` is called and the new repository appears in the list

#### Scenario: Add repository with default branch
- **WHEN** the user enters only a git URL and leaves branch empty
- **THEN** the repository is created with branch `"main"`

#### Scenario: Duplicate repository rejected
- **WHEN** the user adds a repository with a git URL + branch that already exists
- **THEN** an error message is displayed

#### Scenario: Delete a repository
- **WHEN** the user clicks the delete button on a repository
- **THEN** `DELETE /api/v1/repositories/{id}` is called and the repository disappears from the list

#### Scenario: Delete repository in use
- **WHEN** the user tries to delete a repository associated with an active worker
- **THEN** an error message is displayed explaining the repository is in use

### Requirement: Worker card grid
The Workers page SHALL display all workers as cards in a responsive grid. Each card SHALL show: worker ID (truncated), associated task title, worker type badge, effective state with color-coded indicator, and creation timestamp.

#### Scenario: Workers listed as cards
- **WHEN** the Workers page loads with 3 workers
- **THEN** 3 worker cards are rendered in the grid

#### Scenario: Worker state color coding
- **WHEN** a worker card is rendered
- **THEN** the state indicator uses: green for `working`, cyan for `waiting_for_human`, gray for `initialized`, yellow for `done`, dark gray for `archived`

### Requirement: Worker card click navigates to chat UI
Clicking a worker card SHALL navigate the user to the worker's chat UI at `jaw.jarvis.io/<worker_id>` in a new browser tab.

#### Scenario: Worker card clicked
- **WHEN** the user clicks on a worker card
- **THEN** a new tab opens with the URL `http://jaw.jarvis.io/<worker_id>`

### Requirement: Worker creation form
The Workers page SHALL include a way to create a new worker. The creation form SHALL require: a task selection (from tasks without workers), repository selection (multi-select from available repositories), and worker type (defaulting to `claude_code`).

#### Scenario: Create worker from Workers page
- **WHEN** the user selects a task, selects repositories, and clicks "Create Worker"
- **THEN** `POST /api/v1/workers` is called with the selected task, repositories, and type

#### Scenario: Only tasks without workers shown
- **WHEN** the worker creation form opens
- **THEN** the task dropdown only shows tasks that do not already have a worker

### Requirement: Worker deletion from card
Each worker card SHALL have a delete action that removes the worker after confirmation.

#### Scenario: Worker deletion confirmed
- **WHEN** the user confirms worker deletion
- **THEN** `DELETE /api/v1/workers/{id}` is called and the card disappears from the grid

### Requirement: Worker chat UI
The worker pod SHALL serve a chat interface on port 3000, based on the erdrix/claude-code project. The chat UI SHALL allow: sending messages to the Claude Code session, viewing Claude Code responses in real-time, and scrolling through conversation history.

#### Scenario: User sends a message
- **WHEN** the user types a message and presses Enter in the chat UI
- **THEN** the message is sent to the Claude Code session and the response streams back in real-time

#### Scenario: Conversation history visible
- **WHEN** the user opens the worker chat UI
- **THEN** the full conversation history of the Claude Code session is displayed

### Requirement: Frontend API client for workers and repositories
The frontend API client (`api/client.ts`) SHALL include typed functions for: `createWorker`, `listWorkers`, `getWorker`, `updateWorker`, `deleteWorker`, `createRepository`, `listRepositories`, `getRepository`, `deleteRepository`.

#### Scenario: Worker API functions available
- **WHEN** the Workers page imports from `api/client.ts`
- **THEN** all worker and repository CRUD functions are available with proper TypeScript types
