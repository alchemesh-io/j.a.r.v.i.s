## Why

Today every JAW (J.A.R.V.I.S worker) pod is ephemeral: it has no persistent volume, runs with `restartPolicy: Never`, and any data under `/home/node` — including `/home/node/jarvis` (cloned repositories, working tree, edits, agent scratch state) and `/home/node/.claude` (Claude Code conversation history under `projects/`, pulled skills under `skills/`, and merged settings) — lives only in the pod's container filesystem. As soon as the pod fails (`Error`), gets evicted, or the user wants to take a break, the only options are: (a) leave it running and waste resources, or (b) delete the worker and lose every Claude Code turn, every uncommitted change, and the cloned repositories that took several minutes to fetch and clone.

We need a way to **stop** a worker (planned pause or post-failure freeze) without losing its working state, and to **resume** it later attached to the same data — so that long Claude Code sessions can survive transient pod failures, node drains, and explicit human pauses.

## What Changes

- **New `mode` attribute on Worker**: `ephemeral` (default, current behaviour — no PVC, deleting the worker deletes everything) or `stateful` (PVC-backed; the pod is disposable but the home directory survives pod recreation).
- **New `paused` worker state** added to `WorkerState`, distinct from `archived`. `paused` means: the pod and service are deleted, but the worker DB row, PVC, and all data are kept; the worker can be resumed.
- **New `error` worker state** captured when the pod terminates with a failure. For ephemeral workers this is terminal (re-run requires a brand new worker); for stateful workers an `error` worker can be re-run on the same PVC.
- **One PVC per stateful worker mounted at `/home/node`**: when a stateful worker is created, the backend provisions a `PersistentVolumeClaim` (`jarvis-worker-<id>-data`) and the pod spec mounts it at `/home/node`. This single mount persists everything that matters: the cloned repositories under `/home/node/jarvis/`, the Claude Code conversation history under `/home/node/.claude/projects/`, the pulled skills under `/home/node/.claude/skills/`, and the per-user `/home/node/.claude.json`. No symlinks required.
- **Pause / Resume API**: new endpoints `POST /api/v1/workers/{id}/pause` and `POST /api/v1/workers/{id}/resume`. Pause deletes the pod + service (keeps PVC + DB row + state=`paused`). Resume re-creates the pod + service attached to the existing PVC.
- **Re-run on error**: `POST /api/v1/workers/{id}/resume` is also valid when a stateful worker is in `error` state — the entrypoint detects the existing PVC contents and skips re-cloning / re-pulling skills.
- **Idempotent worker entrypoint**: `entrypoint.sh` SHALL detect already-cloned repositories (`<repo>/.git` present), already-pulled skills (`~/.claude/skills/<name>/` present), and an existing `~/.claude/projects/` directory and SHALL skip those initialization steps so resume is fast and non-destructive (no re-clone, no overwriting of session JSONL files). Claude config files coming from the ConfigMap (`policy-limits.json`, `remote-settings.json`, `settings.json`, `~/.claude.json`) SHALL be re-applied on every start so updates from the host take effect, while `projects/` and `skills/` SHALL never be overwritten.
- **Worker pod failure detection**: the backend's pod-status path SHALL map Kubernetes pod phase `Failed` (or container `terminated` with non-zero `exitCode`) to DB state `error`, so the UI can offer "Resume" instead of "Delete".
- **UI controls** (Workers page card and per-task worker action menu): a Pause button on running workers, a Resume button on `paused` and `error` stateful workers, plus a mode badge ("Stateful" / "Ephemeral") on each worker card. A mode toggle is exposed in the Create Worker overlay (default: `ephemeral` for backwards compatibility).
- **Storage cleanup on archive/delete**: deleting a stateful worker (or transitioning it to `archived`) SHALL also delete its PVC; pause SHALL NOT.
- **BREAKING (worker schema)**: `WorkerResponse` gains a required `mode` field; existing rows are migrated with `mode='ephemeral'`.

## Capabilities

### New Capabilities
- `worker-stateful-mode`: stateful vs ephemeral worker mode, single PVC mounted at `/home/node`, pause / resume / re-run lifecycle endpoints, idempotent entrypoint, paused/error states, and storage cleanup on archive.

### Modified Capabilities
- `skill-worker-integration`: skill pulls SHALL be skipped on a stateful resume when the skill directory already exists under the persisted `~/.claude/skills/<name>/` (no re-pull on resume).

## Impact

- **Backend**:
  - `app/models/enums.py`: new `WorkerMode` enum (`ephemeral`, `stateful`); two new `WorkerState` values: `paused`, `error`.
  - `app/models/worker.py`: new `mode` column (default `ephemeral`).
  - `app/schemas/worker.py`: `WorkerCreate` accepts optional `mode`; `WorkerResponse` returns `mode`.
  - `app/services/k8s.py`: new helpers `create_worker_pvc(worker_id)`, `delete_worker_pvc(worker_id)`, `delete_worker_pod_only(worker_id)`; pod spec adds a `PersistentVolumeClaim` volume and a `volumeMount` at `/home/node` when the worker is stateful; pod-status helper additionally reports `error` when the pod phase is `Failed`.
  - `app/routes/workers.py`: new `POST /api/v1/workers/{id}/pause` and `POST /api/v1/workers/{id}/resume` endpoints; archive/delete tear down the PVC for stateful workers.
  - Alembic migration: add `mode` column with default `ephemeral`, expand `worker_state` enum to include `paused` and `error`.
- **Worker image**:
  - `worker/entrypoint.sh`: ensure `/home/node/jarvis` and `/home/node/.claude` exist on first start (PVC may be empty); idempotent clone / skill-pull steps; preserve existing `~/.claude/projects/` and `~/.claude/skills/` across restarts; re-apply ConfigMap-sourced settings every start.
  - `worker/setup-claude.sh`: never overwrite existing session JSONL files; keep merged settings deterministic.
- **Frontend**:
  - `pages/Workers/`: new mode badge on worker cards; pause / resume buttons gated on state + mode.
  - `pages/Workers/CreateWorkerOverlay.tsx`: new mode selector (default `ephemeral`).
  - `pages/TaskBoard/`: matching pause/resume affordances on task-card worker controls.
  - `api/client.ts`: new `pauseWorker(id)`, `resumeWorker(id)` functions and a `mode` field on `Worker` types.
- **Infrastructure**:
  - `helm/jarvis/values.yaml`: new `worker.persistence.storageClass` (default: `standard` for Minikube) and `worker.persistence.size` (default `2Gi`). PVCs are created at runtime by the backend, not by the Helm chart.
  - `helm/jarvis/templates/worker-role.yaml`: extend RBAC to grant the worker ServiceAccount `get,list,create,delete` on `persistentvolumeclaims` in the `jarvis` namespace.
  - The existing worker `ServiceAccount` is reused; only the `Role` rules change.
- **Migrations & backwards compatibility**:
  - Existing `worker` rows are migrated with `mode='ephemeral'`, preserving current behaviour.
  - The pod-creation flow continues to produce the same pod for ephemeral workers (no PVC volume, no PVC mount, no behaviour change).
- **Constraints**:
  - PVCs use `ReadWriteOnce`; only one pod can attach at a time, which matches the one-pod-per-worker invariant.
  - Stateful workers cost more cluster resources (PVC + storage class). Acceptable for local dev (Minikube `standard` storage class) and our K8s targets.
