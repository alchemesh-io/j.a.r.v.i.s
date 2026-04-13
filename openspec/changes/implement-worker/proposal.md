## Why

JARVIS currently manages tasks, key focuses, and reporting but has no mechanism to actually *execute* work on those tasks. There is no way to spin up an AI coding session (Claude Code) tied to a task, manage its lifecycle, or interact with it through the JARVIS UI. Workers bridge the gap between task planning and task execution by providing dedicated, containerized Claude Code sessions linked to JARVIS tasks, each with its own git repositories, skills, and interactive chat UI.

## What Changes

- **New Worker model** with lifecycle states (Initialized → Working → Waiting for human → Done → Archived), linked to a JARVIS task, with configurable repositories and worker type
- **New Repository model** for tracking git repositories (URL + branch), enforcing global uniqueness of the repo/branch pair across all of JARVIS
- **New Worker management page** in the frontend UI for managing repositories and viewing/managing all workers (card-based layout consistent with tasks and key focuses)
- **New Worker Docker image** containing Claude Code (npm, pinned version), JARVIS worker UI, worker status endpoint, arctl CLI, and a pre-configured `~/.claude` folder
- **New worker UI** based on [erdrix/claude-code](https://github.com/erdrix/claude-code) enabling interactive chat with the Claude Code session running inside the worker pod
- **New gateway routing** for workers at `jaw.jarvis.io`, with path-based routing per worker (`/<worker_id>`)
- **New worker status endpoint** reporting worker state based on pod activity
- **ConfigMap-based Claude configuration sync** replicating `~/.claude` config files into all worker pods via init containers
- **Worker initialization flow**: git clone repositories, pull skills from JAAR via arctl, configure Claude Code, start the session with a worker-id-matched session ID
- **Task-worker integration** on each task card showing worker status icon and click-through to the worker chat UI
- **VSCode remote integration** enabling VSCode remote sessions on worker pods with the correct Claude Code session

## Capabilities

### New Capabilities
- `worker-model`: Worker and Repository data models, API endpoints (CRUD), state machine lifecycle management
- `worker-pod`: Docker image specification, Kubernetes pod/deployment manifests, init container setup, ConfigMap/Secret mounting, and worker initialization sequence
- `worker-ui`: Worker management page in the JARVIS frontend (repository management, worker list, worker chat UI based on erdrix/claude-code)
- `worker-gateway`: Istio gateway routing for `jaw.jarvis.io` with path-based worker routing (`/<worker_id>`)
- `worker-task-integration`: Task card worker status indicators, play button for worker creation, click-through navigation, and VSCode remote launch

### Modified Capabilities
- `task-management-api`: Tasks gain a relationship to workers; task responses include worker status
- `task-board-ui`: Task cards display worker state icon and provide navigation to worker chat UI; play button to initiate a worker from a task

## Impact

- **Backend**: New `Worker` and `Repository` SQLAlchemy models, new Alembic migration, new `/api/v1/workers` and `/api/v1/repositories` route modules, new enums for `WorkerState` and `WorkerType`
- **Frontend**: New `/workers` page, new worker-related components, updates to `TaskCard` for worker status display, new routes in `App.tsx`, new API client functions for workers/repositories
- **MCP Server**: New tools for worker management (create, list, get, update state)
- **Infrastructure**: New Docker image (worker), new Helm templates (worker deployment, service, configmap, httproute), new `jaw.jarvis.io` host routing, new Kubernetes secrets for GitHub tokens and Anthropic API keys
- **Dependencies**: Requires the [erdrix/claude-code](https://github.com/erdrix/claude-code) project as the base for the worker chat UI; requires arctl CLI in the worker image for skill pulling
- **Configuration**: New ConfigMap for Claude config files (`policy-limits.json`, `remote-settings.json`, `.claude.json`, `settings.json`) synced from host
