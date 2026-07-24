# Spec: worker-interactive-runtime

## ADDED Requirements

### Requirement: Claude Code runs interactively as the worker container's main process

The worker pod's `worker` container SHALL run Claude Code interactively as its main process: the entrypoint performs provisioning (config copy, repository clone, skill pull) and then `exec`s `claude --dangerously-skip-permissions` so Claude Code is PID 1 of the container. The container spec SHALL set `tty: true`, `stdin: true`, and `stdinOnce: false` so the Kubernetes `Attach` API yields an interactive PTY. The headless launch (`--print`, `--input-format stream-json`, `/tmp/claude-input` FIFO) SHALL be removed.

#### Scenario: Attach reaches the Claude PTY

- **WHEN** a client attaches to the running `worker` container via the Kubernetes `Attach` API
- **THEN** it receives the live Claude Code interactive screen and can send keystrokes to it

#### Scenario: No FIFO remains

- **WHEN** the worker container starts
- **THEN** no `/tmp/claude-input` FIFO is created and no `--print`/`stream-json` flags are passed to Claude Code

### Requirement: Task prompt is injected on first launch

The backend SHALL pass the worker's task as a `TASK_PROMPT` environment variable (task title and description) on the `worker` container. When no prior Claude session exists, the entrypoint SHALL launch Claude Code with `TASK_PROMPT` as the initial interactive prompt so the task is submitted as the first turn.

#### Scenario: Fresh worker receives its task

- **WHEN** a worker is created for a task and its pod starts for the first time
- **THEN** Claude Code starts interactively with the task prompt already submitted as the first user message

#### Scenario: Empty prompt tolerated

- **WHEN** `TASK_PROMPT` is empty or unset
- **THEN** Claude Code starts interactively with no initial prompt and the container does not crash

### Requirement: Conversation resume via session probe

Before launching Claude Code, the entrypoint SHALL probe `~/.claude/projects/**/*.jsonl`. If at least one session file exists, it SHALL launch `claude --dangerously-skip-permissions --resume <session-id>` using the most recently modified session file's ID; otherwise it SHALL take the fresh-launch path with `TASK_PROMPT`. The previous unconditional `--resume <uuid-derived-from-worker-id>` SHALL be removed.

#### Scenario: Stateful worker resumes conversation after restart

- **WHEN** a stateful worker is stopped and restarted and its PVC contains a prior session JSONL under `~/.claude/projects/`
- **THEN** Claude Code launches with `--resume` targeting that session and the conversation history is available

#### Scenario: First boot takes the fresh path

- **WHEN** a worker pod starts with no session files under `~/.claude/projects/`
- **THEN** Claude Code launches without `--resume` and with the task prompt

### Requirement: Status server runs as a sidecar container with a shared state file

The worker pod SHALL run a second container `status` (same image) whose main process is the status server on port 8080. Both containers SHALL share an `emptyDir` volume mounted at `/worker-state`, and the Claude Code hooks (`PreToolUse` → `working`, `Stop`/`Notification` → `waiting_for_human`) SHALL write the state to the file named by the `STATE_FILE` environment variable (`/worker-state/claude-state`), which the status server reads and pushes to the backend. The status server SHALL tolerate a missing state file (reporting the worker's initial state). The vestigial container port 3000 (`ui`) SHALL be removed from the pod spec.

#### Scenario: State flows from hooks to backend

- **WHEN** Claude Code fires a `PreToolUse` hook in the `worker` container
- **THEN** `working` is written to `/worker-state/claude-state` and the `status` sidecar PATCHes the backend worker state within its push interval

#### Scenario: Status endpoint served by sidecar

- **WHEN** the backend queries the worker Service on port 8080 `/status`
- **THEN** the sidecar responds with the current state even if Claude Code is still provisioning

### Requirement: Worker pods are privileged only when skills are requested

The backend SHALL set `privileged: true` on the `worker` container only when the worker references at least one skill (dockerd is required for `arctl skill pull`). Workers without skills SHALL run with no privileged flag. The `status` sidecar SHALL never be privileged.

#### Scenario: Skill-less worker is unprivileged

- **WHEN** a worker is created with an empty `skills` list
- **THEN** the created pod has no `privileged: true` on any container

#### Scenario: Worker with skills keeps dockerd capability

- **WHEN** a worker is created with one or more skills
- **THEN** the `worker` container is privileged and skill pulling succeeds as before

### Requirement: Idempotent worker pod creation

`create_worker_pod` SHALL delete any existing pod with the same name (ignoring 404) before creating the new pod, so restart flows are robust against leftover terminated pods.

#### Scenario: Restart with leftover pod

- **WHEN** a stateful worker is restarted while a previous terminated pod with the same name still exists
- **THEN** the old pod is deleted and the new pod is created without a 409 conflict

### Requirement: Worker resources come from deployment configuration

Worker pod CPU/memory requests and limits SHALL be sourced from environment configuration (backend ConfigMap fed by Helm `worker.resources` values) instead of constants in `k8s.py`. When unset, the current Helm defaults apply.

#### Scenario: Helm values reach the pod spec

- **WHEN** the chart sets `worker.resources.requests.memory: 512Mi` and a worker is created
- **THEN** the worker pod's `worker` container has a 512Mi memory request
