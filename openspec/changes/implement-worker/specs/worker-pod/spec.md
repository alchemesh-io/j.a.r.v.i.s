## ADDED Requirements

### Requirement: Worker Docker image base
The worker Docker image SHALL use `node:22-slim` as the base image, with `@anthropic-ai/claude-code` installed at a pinned npm version.

#### Scenario: Claude Code available in image
- **WHEN** the worker container starts
- **THEN** the `claude` CLI command is available on the PATH and reports the pinned version

### Requirement: Worker Docker image toolchain
The worker Docker image SHALL include: Python 3.12, `uv`, `git`, `curl`, `jq`, and `arctl` CLI.

#### Scenario: All tools available
- **WHEN** the container starts
- **THEN** `python3 --version`, `uv --version`, `git --version`, `arctl --version` all return successfully

### Requirement: Worker Docker image user
The worker Docker image SHALL run as a non-root user with UID 1000. The home directory SHALL be `/home/worker` with pre-created `~/jarvis` (workdir) and `~/.claude` (config) directories.

#### Scenario: Container runs as non-root
- **WHEN** the container starts
- **THEN** `id -u` returns `1000` and `~/jarvis` and `~/.claude` directories exist

### Requirement: Worker pod creation via Kubernetes API
The backend SHALL create worker pods dynamically using the Kubernetes Python client. Each worker pod SHALL be created in the `jarvis` namespace with labels `app=jarvis-worker` and `worker-id=<worker_id>`.

#### Scenario: Pod created for new worker
- **WHEN** a worker is created via the API
- **THEN** a Kubernetes Pod is created in the `jarvis` namespace with the worker image, correct labels, and environment variables

#### Scenario: Pod creation failure
- **WHEN** the Kubernetes API returns an error during pod creation
- **THEN** the worker record is updated with an error state and the API returns HTTP 503

### Requirement: Worker service creation
The backend SHALL create a Kubernetes Service (`jarvis-worker-<worker_id>`) for each worker pod, exposing port 3000 (worker UI) and port 8080 (status endpoint).

#### Scenario: Service routes to worker pod
- **WHEN** a worker pod is running
- **THEN** the service `jarvis-worker-<worker_id>` resolves in-cluster and routes to the pod's ports

### Requirement: Worker pod environment variables
Each worker pod SHALL receive environment variables from: a Kubernetes Secret containing `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`, a Kubernetes Secret containing `GITHUB_TOKEN` for repository cloning, and pod metadata including `WORKER_ID`, `TASK_ID`, and `JAAR_URL`.

#### Scenario: API key available in pod
- **WHEN** the worker container starts
- **THEN** either `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` is set in the environment

#### Scenario: GitHub token available for cloning
- **WHEN** the entrypoint script clones repositories
- **THEN** the `GITHUB_TOKEN` environment variable is available for authenticated git operations

### Requirement: Claude config ConfigMap mount
Worker pods SHALL mount the `jarvis-claude-config` ConfigMap as a read-only volume at `/init-claude-config/`. The ConfigMap SHALL contain keys: `policy-limits.json`, `remote-settings.json`, `claude.json`, `settings.json`.

#### Scenario: Config files available at mount path
- **WHEN** the worker container starts
- **THEN** `/init-claude-config/policy-limits.json`, `/init-claude-config/remote-settings.json`, `/init-claude-config/claude.json`, and `/init-claude-config/settings.json` are all readable

### Requirement: Worker entrypoint initialization sequence
The worker entrypoint script SHALL execute the following steps in order: (1) copy Claude config files from `/init-claude-config/` to `~/.claude/` and `~/.claude.json`, (2) configure JARVIS MCP server in Claude Code settings, (3) clone all git repositories into `~/jarvis/`, (4) pull selected skills from JAAR using `arctl`, (5) start the Claude Code session, worker UI, and status endpoint.

#### Scenario: Config files copied to correct locations
- **WHEN** the entrypoint runs step 1
- **THEN** `~/.claude/policy-limits.json`, `~/.claude/remote-settings.json`, `~/.claude/settings.json` exist, and `~/.claude.json` exists in the home directory

#### Scenario: Repositories cloned successfully
- **WHEN** the entrypoint runs step 3 with 2 configured repositories
- **THEN** both repositories are cloned into `~/jarvis/<repo-name>/` using the GitHub token for authentication

#### Scenario: Repository clone failure
- **WHEN** a git clone fails (bad URL, auth error)
- **THEN** the entrypoint logs the error and continues with remaining repositories

#### Scenario: Skills pulled from JAAR
- **WHEN** the entrypoint runs step 4
- **THEN** `arctl` is invoked to pull all selected skills from the JAAR registry

#### Scenario: All three processes started
- **WHEN** the entrypoint completes initialization
- **THEN** the Claude Code session (with `--session-id <worker_id>`), worker UI (port 3000), and status endpoint (port 8080) are all running

### Requirement: Worker status endpoint
Each worker pod SHALL expose an HTTP status endpoint on port 8080 at `/status` that reports the worker's live state by inspecting the Claude Code process.

#### Scenario: Claude Code actively processing
- **WHEN** the Claude Code process is writing output (not waiting for input)
- **THEN** `GET /status` returns `{ "state": "working" }` with HTTP 200

#### Scenario: Claude Code waiting for input
- **WHEN** the Claude Code process is idle and waiting for human input
- **THEN** `GET /status` returns `{ "state": "waiting_for_human" }` with HTTP 200

#### Scenario: Claude Code process not running
- **WHEN** the Claude Code process has exited or crashed
- **THEN** `GET /status` returns `{ "state": "error", "message": "Claude Code process not running" }` with HTTP 200

### Requirement: Backend ServiceAccount and RBAC
The Helm chart SHALL define a ServiceAccount, Role, and RoleBinding granting the backend pod permissions to create, get, list, delete Pods, Services, and HTTPRoutes in the `jarvis` namespace.

#### Scenario: Backend can create worker pods
- **WHEN** the backend attempts to create a Pod in the `jarvis` namespace
- **THEN** the Kubernetes API accepts the request (not forbidden)

#### Scenario: Backend can delete worker resources
- **WHEN** the backend attempts to delete a Pod, Service, or HTTPRoute
- **THEN** the Kubernetes API accepts the request (not forbidden)

### Requirement: Worker pod resource limits
Each worker pod SHALL have resource requests and limits configured. Default: requests `256Mi` memory / `250m` CPU, limits `1Gi` memory / `1000m` CPU. These values SHALL be configurable via Helm values.

#### Scenario: Pod created with resource limits
- **WHEN** a worker pod is created
- **THEN** the pod spec includes the configured resource requests and limits

### Requirement: Claude config ConfigMap Helm template
The Helm chart SHALL include a ConfigMap template (`worker-claude-config.yaml`) that creates the `jarvis-claude-config` ConfigMap. The ConfigMap data SHALL be populated from files specified in Helm values.

#### Scenario: ConfigMap rendered by Helm
- **WHEN** the Helm chart is rendered with Claude config values
- **THEN** the ConfigMap `jarvis-claude-config` is created with all four config file keys

### Requirement: Makefile target for Claude config sync
The Makefile SHALL include a `sync-claude-config` target that reads Claude config files from the developer's machine and updates the `jarvis-claude-config` ConfigMap in the cluster.

#### Scenario: Config synced from host
- **WHEN** `make sync-claude-config` is executed
- **THEN** the ConfigMap is updated with the current contents of `~/.claude/policy-limits.json`, `~/.claude/remote-settings.json`, `~/.claude.json`, and `~/.claude/settings.json`

## Implementation Additions

### Requirement: Hook-based state reporting via setup-claude.sh
The worker image SHALL include a `setup-claude.sh` script that configures Claude Code hooks for state reporting. The script SHALL create hook scripts that write state strings to `/tmp/claude-state`: `PreToolUse` writes `"working"`, and `Stop`/`Notification` write `"waiting_for_human"`. The hooks SHALL be configured in `~/.claude/settings.json`.

#### Scenario: Hooks configured on startup
- **WHEN** the entrypoint runs `setup-claude.sh`
- **THEN** `~/.claude/settings.json` contains hook entries for `PreToolUse`, `Stop`, and `Notification` pointing to the generated hook scripts

#### Scenario: State file updated by hook
- **WHEN** Claude Code invokes a tool
- **THEN** the `PreToolUse` hook writes `"working"` to `/tmp/claude-state`

#### Scenario: State transitions to waiting
- **WHEN** Claude Code finishes processing and emits a Stop or Notification event
- **THEN** the corresponding hook writes `"waiting_for_human"` to `/tmp/claude-state`

### Requirement: Workspace pre-trust via setup-claude.sh
The `setup-claude.sh` script SHALL configure workspace pre-trust by writing a projects entry in `~/.claude.json` for the `~/jarvis` workspace directory. This prevents Claude Code from prompting for workspace trust on first launch.

#### Scenario: Workspace trusted on startup
- **WHEN** the entrypoint runs `setup-claude.sh`
- **THEN** `~/.claude.json` contains a projects entry for `/home/node/jarvis` with `allowedTools` set to allow all tools

### Requirement: MCP server configuration via setup-claude.sh
The `setup-claude.sh` script SHALL configure the JARVIS MCP server in Claude Code settings, enabling Claude Code to use JARVIS tools during the session.

#### Scenario: MCP server configured
- **WHEN** the entrypoint runs `setup-claude.sh`
- **THEN** Claude Code settings contain an MCP server entry for the JARVIS MCP server

### Requirement: Status server push-based state reporting
The status server SHALL read the current state from `/tmp/claude-state` and push it to the backend via `PATCH /api/v1/workers/{id}` every 3 seconds using the `BACKEND_URL` and `WORKER_ID` environment variables. The status server SHALL also continue to serve `GET /status` for direct queries.

#### Scenario: State pushed to backend
- **WHEN** the status server reads `"working"` from `/tmp/claude-state`
- **THEN** it sends `PATCH <BACKEND_URL>/api/v1/workers/<WORKER_ID>` with `{ "state": "working" }` within 3 seconds

#### Scenario: Backend unreachable
- **WHEN** the PATCH request to the backend fails
- **THEN** the status server logs the error and retries on the next 3-second cycle

### Requirement: Claude Code pinned version
The worker Docker image SHALL pin Claude Code at version 2.1.104 via `npm install -g @anthropic-ai/claude-code@2.1.104`.

#### Scenario: Claude Code version matches
- **WHEN** `claude --version` is run in the container
- **THEN** the output includes `2.1.104`

### Requirement: Claude Code named pipe stream mode
Claude Code SHALL run in non-interactive mode with `--print --input-format stream-json --output-format stream-json --dangerously-skip-permissions`, receiving input through a named pipe. The worker UI SHALL write user messages to the named pipe.

#### Scenario: Claude Code accepts stream-json input
- **WHEN** a JSON message is written to the named pipe
- **THEN** Claude Code processes it and emits a stream-json response

### Requirement: Worker Docker image uses node user
The worker Docker image SHALL use the built-in `node` user (UID 1000) from the `node:22-slim` base image, with home directory `/home/node`. The `~/jarvis` workdir and `~/.claude` config directory SHALL be created under `/home/node`.

#### Scenario: Container runs as node user
- **WHEN** the container starts
- **THEN** `whoami` returns `node`, `id -u` returns `1000`, and `$HOME` is `/home/node`

### Requirement: BACKEND_URL passed to worker pods
Each worker pod SHALL receive the `BACKEND_URL` environment variable, pointing to the backend service's in-cluster URL. This is used by the status server to push state updates.

#### Scenario: BACKEND_URL available in pod
- **WHEN** the worker container starts
- **THEN** the `BACKEND_URL` environment variable is set to the backend's in-cluster service URL
