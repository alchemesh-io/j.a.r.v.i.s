## ADDED Requirements

### Requirement: Worker status indicator on task cards
Each task card on the task board SHALL display a small status icon indicating the worker state when a worker exists for that task. The icon SHALL use the same color coding as the worker card grid (green=working, cyan=waiting, gray=initialized, yellow=done, dark gray=archived).

#### Scenario: Task with active worker shows status
- **WHEN** a task card is rendered for a task that has a worker in `working` state
- **THEN** a green status indicator icon is displayed on the card

#### Scenario: Task without worker shows no indicator
- **WHEN** a task card is rendered for a task that has no worker
- **THEN** no worker status indicator is displayed

### Requirement: Play button on tasks without workers
Each task card for a task without an existing worker SHALL display a "play" button (play icon) that initiates worker creation.

#### Scenario: Play button visible on task without worker
- **WHEN** a task card is rendered for a task with no worker
- **THEN** a play button icon is visible on the card

#### Scenario: Play button hidden on task with worker
- **WHEN** a task card is rendered for a task that already has a worker
- **THEN** the play button is not displayed (replaced by the worker status indicator)

### Requirement: Play button opens worker creation dialog
Clicking the play button on a task card SHALL open a dialog pre-filled with the task, allowing the user to select repositories and confirm worker creation.

#### Scenario: Play button clicked
- **WHEN** the user clicks the play button on a task card
- **THEN** a dialog opens with the task pre-selected, repository multi-select, and a "Create Worker" confirmation button

#### Scenario: Worker created from task card
- **WHEN** the user selects repositories and clicks "Create Worker" in the dialog
- **THEN** `POST /api/v1/workers` is called with the task ID and selected repository IDs, and the task card updates to show the worker status indicator

### Requirement: Worker status click navigates to chat UI
Clicking the worker status indicator on a task card SHALL open the worker's chat UI in a new browser tab.

#### Scenario: Worker status indicator clicked
- **WHEN** the user clicks the worker status indicator on a task card
- **THEN** a new tab opens with `http://jaw.jarvis.io/<worker_id>`

### Requirement: VSCode icon on tasks with workers
Each task card for a task with an active worker (state not `archived`) SHALL display a VSCode icon button.

#### Scenario: VSCode icon visible on task with active worker
- **WHEN** a task card is rendered for a task with a worker in `working` state
- **THEN** a VSCode icon button is visible on the card

#### Scenario: VSCode icon hidden on task with archived worker
- **WHEN** a task card is rendered for a task with a worker in `archived` state
- **THEN** the VSCode icon button is not displayed

#### Scenario: VSCode icon hidden on task without worker
- **WHEN** a task card is rendered for a task with no worker
- **THEN** the VSCode icon button is not displayed

### Requirement: VSCode icon opens remote session
Clicking the VSCode icon SHALL open a `vscode://` URI that launches VSCode with the Kubernetes extension, targeting the worker pod in the `jarvis` namespace.

#### Scenario: VSCode URI generated correctly
- **WHEN** the user clicks the VSCode icon for worker `abc123def456`
- **THEN** the browser opens a `vscode://` URI with the pod name `jarvis-worker-abc123def456` and namespace `jarvis`

### Requirement: Task API response includes worker summary
The task list and task detail API responses SHALL include a `worker` field containing the worker summary (id, state, effective_state) when a worker exists for the task, or `null` when no worker exists.

#### Scenario: Task with worker includes summary
- **WHEN** `GET /api/v1/tasks/{id}` is called for a task with an active worker
- **THEN** the response includes `"worker": { "id": "<worker_id>", "state": "initialized", "effective_state": "working" }`

#### Scenario: Task without worker returns null
- **WHEN** `GET /api/v1/tasks/{id}` is called for a task without a worker
- **THEN** the response includes `"worker": null`
