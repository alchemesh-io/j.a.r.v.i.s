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

## Implementation Additions

### Requirement: WorkerBrain component in JADS
The `@jarvis/jads` design system SHALL export a `WorkerBrain` component (`packages/jads/src/components/TaskCard/WorkerBrain.tsx`) that renders a miniature animated SVG with concentric rings. The animation colors SHALL be driven by the worker state: blue for `working`, red for `waiting_for_human`, green for `done`, gray for `initialized`, dark/muted for `archived`. The component SHALL display a state label in the center of the SVG.

#### Scenario: WorkerBrain renders with state color
- **WHEN** `<WorkerBrain state="working" />` is rendered
- **THEN** the SVG rings animate with blue coloring and "working" text appears in the center

#### Scenario: WorkerBrain renders archived state
- **WHEN** `<WorkerBrain state="archived" />` is rendered
- **THEN** the SVG rings display in dark/muted colors with "archived" text in the center

### Requirement: TaskCard restructured layout
The TaskCard component SHALL use a horizontal layout with a left body area (task content, title, type label) and a right action sidebar (vertical). The type label SHALL be positioned in the content area (not the sidebar). Check/undo buttons SHALL be placed at the bottom of the sidebar.

#### Scenario: TaskCard horizontal layout
- **WHEN** a TaskCard is rendered with a task
- **THEN** the card displays a left content body and a right vertical action sidebar

#### Scenario: Type label in content area
- **WHEN** a TaskCard is rendered for a task with type "implementation"
- **THEN** the "implementation" type label appears in the left content body, not the sidebar

### Requirement: DateNav component on all board pages
The frontend SHALL include a `DateNav` component (`src/components/DateNav.tsx`) with `DateNavPrev`, `DateNavNext`, and `DateNavToday` sub-components. The DateNav SHALL be rendered on all three board pages (Tasks, Key Focuses, Reports). For quarterly scope, the navigation SHALL step by 3 months.

#### Scenario: DateNav on TaskBoard
- **WHEN** the TaskBoard page renders
- **THEN** DateNav is visible with previous, next, and today navigation buttons

#### Scenario: Quarterly DateNav steps by 3 months
- **WHEN** the user clicks "next" in DateNav while viewing a quarterly scope
- **THEN** the date advances by 3 months

#### Scenario: DateNav today button
- **WHEN** the user clicks the "today" button in DateNav
- **THEN** the view navigates to the current date's period

### Requirement: Task filters on TaskBoard
The TaskBoard SHALL include filter controls rendered as tab-style buttons for: task type (refinement, implementation, review), worker presence (with worker, without worker), and worker state. Active filter tabs SHALL display state-colored backgrounds matching the worker state colors.

#### Scenario: Filter by task type
- **WHEN** the user clicks the "implementation" type filter tab
- **THEN** only tasks with type `implementation` are displayed

#### Scenario: Filter by worker presence
- **WHEN** the user clicks the "with worker" filter tab
- **THEN** only tasks that have an associated worker are displayed

#### Scenario: Filter by worker state
- **WHEN** the user clicks the "working" state filter tab
- **THEN** only tasks whose worker is in `working` state are displayed

#### Scenario: State-colored active filter
- **WHEN** the "working" state filter tab is active
- **THEN** the tab displays with a blue background matching the working state color

### Requirement: VSCode Dev Containers integration via WorkerBrain click
Clicking the WorkerBrain animation on a task card (for tasks with active workers) SHALL open the VSCode Dev Containers URI by calling `GET /api/v1/workers/{id}/vscode-uri` and navigating to the returned URI. The separate VSCode icon button is removed.

#### Scenario: WorkerBrain click opens VSCode
- **WHEN** the user clicks the WorkerBrain on a task card with an active worker
- **THEN** the frontend calls `GET /api/v1/workers/{id}/vscode-uri` and opens the returned `vscode://` URI

#### Scenario: VSCode URI format
- **WHEN** the vscode-uri endpoint is called for worker `abc123` on KUBE_CONTEXT `minikube`
- **THEN** the response contains a URI in the format `vscode://vscode-remote/k8s-container+<hex>/home/node` where `<hex>` encodes the context, namespace, pod name, and container name

### Requirement: Live polling on TaskBoard
The TaskBoard SHALL poll task data (which includes worker summaries) every 5 seconds using TanStack Query's `refetchInterval: 5000` to reflect worker state changes on task cards without manual refresh.

#### Scenario: Task card worker state updates
- **WHEN** a worker transitions from `initialized` to `working`
- **THEN** the associated task card's WorkerBrain animation updates to blue within 5 seconds
