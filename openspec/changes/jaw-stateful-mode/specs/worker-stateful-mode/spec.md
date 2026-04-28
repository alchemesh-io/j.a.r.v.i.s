# Spec: worker-stateful-mode

## Purpose

Defines the stateful operating mode for JAW workers: per-worker persistent storage, pause / resume / re-run lifecycle, and the resulting worker state machine. In stateful mode, the worker's `/home/node` directory survives pod recreation so that the cloned repositories under `/home/node/jarvis/` and the Claude Code session history under `/home/node/.claude/projects/` are preserved across failures and explicit pauses.

## ADDED Requirements

### Requirement: Worker has a mode attribute

A `Worker` SHALL declare a `mode` of either `ephemeral` (default) or `stateful`. The mode is set at creation time and SHALL NOT change during the worker's lifetime. `ephemeral` workers preserve current behaviour (no PVC, all data lost on pod termination). `stateful` workers SHALL provision a `PersistentVolumeClaim` mounted at `/home/node` so that everything under the worker's home directory survives pod recreation.

#### Scenario: Worker created in ephemeral mode keeps current behaviour

- **WHEN** a client calls `POST /api/v1/workers` with `{"task_id": 1, "mode": "ephemeral"}` (or omits `mode`)
- **THEN** the worker is created with `mode = "ephemeral"`
- **AND** no `PersistentVolumeClaim` is provisioned
- **AND** the resulting pod has no volume mount at `/home/node`

#### Scenario: Worker created in stateful mode provisions a PVC

- **WHEN** a client calls `POST /api/v1/workers` with `{"task_id": 1, "mode": "stateful"}`
- **THEN** the worker is created with `mode = "stateful"`
- **AND** the backend creates a `PersistentVolumeClaim` named `jarvis-worker-<id>-data` in the `jarvis` namespace with `accessModes: [ReadWriteOnce]`
- **AND** the resulting pod mounts that PVC at `/home/node`

#### Scenario: Mode is immutable

- **WHEN** a client calls `PATCH /api/v1/workers/{id}` with a `mode` field
- **THEN** the request is rejected with HTTP 400 and the worker's `mode` is unchanged

#### Scenario: WorkerResponse exposes mode

- **WHEN** a client calls `GET /api/v1/workers/{id}`
- **THEN** the response body includes a `mode` field set to either `"ephemeral"` or `"stateful"`

### Requirement: Worker state machine includes paused and error states

The `WorkerState` enum SHALL include `paused` and `error` in addition to the existing `initialized`, `working`, `waiting_for_human`, `done`, and `archived` values. `paused` SHALL be entered only via the pause endpoint. `error` SHALL be entered when the worker pod terminates with a failure. `archived` SHALL remain the terminal state used when the worker is being removed.

#### Scenario: Pod failure transitions worker to error state

- **WHEN** the worker pod's phase is `Failed`, or its `worker` container is `terminated` with a non-zero `exitCode`
- **THEN** the next call to `GET /api/v1/workers/{id}` SHALL return `state = "error"`
- **AND** the persisted DB state SHALL be updated to `error`

#### Scenario: Pause transitions worker to paused state

- **WHEN** a client calls `POST /api/v1/workers/{id}/pause` on a worker whose state is `working` or `waiting_for_human`
- **THEN** the worker's DB state becomes `paused`

#### Scenario: Archived state remains terminal

- **WHEN** a worker has state `archived`
- **THEN** the pause and resume endpoints SHALL respond with HTTP 409 and the state SHALL NOT change

### Requirement: Pause endpoint deletes pod and service but keeps storage

The endpoint `POST /api/v1/workers/{id}/pause` SHALL delete the worker's pod and service and SHALL set the worker's state to `paused`. For stateful workers it SHALL NOT delete the PVC. For ephemeral workers it SHALL be rejected with HTTP 409, since pausing an ephemeral worker would lose all data.

#### Scenario: Pause stateful worker keeps PVC

- **WHEN** a client calls `POST /api/v1/workers/{id}/pause` on a stateful worker in state `working`
- **THEN** the worker pod `jarvis-worker-<id>` and service `jarvis-worker-<id>` are deleted
- **AND** the PVC `jarvis-worker-<id>-data` SHALL still exist
- **AND** the worker DB state SHALL be `paused`

#### Scenario: Pause is rejected for ephemeral worker

- **WHEN** a client calls `POST /api/v1/workers/{id}/pause` on an ephemeral worker
- **THEN** the response SHALL be HTTP 409
- **AND** the worker's pod, service, and DB state SHALL be unchanged

#### Scenario: Pause is idempotent

- **WHEN** a client calls `POST /api/v1/workers/{id}/pause` on a worker already in state `paused`
- **THEN** the response SHALL be HTTP 200
- **AND** the worker's DB state SHALL remain `paused`
- **AND** no Kubernetes resources SHALL be modified

### Requirement: Resume endpoint re-creates pod attached to existing PVC

The endpoint `POST /api/v1/workers/{id}/resume` SHALL be valid only for stateful workers in state `paused` or `error`. It SHALL re-create the worker's pod and service using the same configuration as initial creation (same image, env, repositories, skills) and SHALL mount the existing `jarvis-worker-<id>-data` PVC at `/home/node`. After resume the worker's state SHALL transition back to `initialized` and then progress through the normal state machine driven by the running pod.

#### Scenario: Resume from paused

- **WHEN** a client calls `POST /api/v1/workers/{id}/resume` on a stateful worker in state `paused`
- **THEN** a new pod `jarvis-worker-<id>` is created with the same env vars as the original creation
- **AND** the pod mounts the existing PVC `jarvis-worker-<id>-data` at `/home/node`
- **AND** a new service `jarvis-worker-<id>` is created
- **AND** the worker DB state transitions to `initialized`

#### Scenario: Resume from error (re-run)

- **WHEN** a client calls `POST /api/v1/workers/{id}/resume` on a stateful worker in state `error`
- **THEN** the same actions as resume-from-paused are performed
- **AND** the existing PVC is reused — the cloned repositories, Claude session history, and pulled skills are preserved

#### Scenario: Resume rejected for ephemeral worker

- **WHEN** a client calls `POST /api/v1/workers/{id}/resume` on an ephemeral worker
- **THEN** the response SHALL be HTTP 409 with a message indicating that ephemeral workers cannot be resumed

#### Scenario: Resume rejected from invalid state

- **WHEN** a client calls `POST /api/v1/workers/{id}/resume` on a stateful worker in state `working`, `waiting_for_human`, `done`, `archived`, or `initialized`
- **THEN** the response SHALL be HTTP 409
- **AND** no Kubernetes resources SHALL be modified

### Requirement: Stateful pod mounts the PVC at /home/node

When a stateful worker pod is created (initial creation or resume), the K8s service SHALL add a volume of type `persistentVolumeClaim` referencing `jarvis-worker-<id>-data` and SHALL add a `volumeMount` on the `worker` container at path `/home/node`. The pod's `restartPolicy` SHALL remain `Never` so that pod-level failures bubble up to the backend as the `error` state, leaving recovery under explicit user control via the resume endpoint.

#### Scenario: Stateful pod has the PVC mount

- **WHEN** the backend creates the pod for a stateful worker
- **THEN** the pod spec includes a volume `jarvis-data` whose `persistentVolumeClaim.claimName` is `jarvis-worker-<id>-data`
- **AND** the `worker` container has a `volumeMount` with `name: jarvis-data` and `mountPath: /home/node`

#### Scenario: Ephemeral pod has no PVC mount

- **WHEN** the backend creates the pod for an ephemeral worker
- **THEN** the pod spec contains no volume backed by a `PersistentVolumeClaim`
- **AND** the `worker` container has no `volumeMount` at `/home/node`

### Requirement: Archive and delete tear down the PVC for stateful workers

When a worker is transitioned to `archived` (via `PATCH state=archived`) or deleted (via `DELETE`), the backend SHALL delete the worker's pod, service, and — for stateful workers — its PVC `jarvis-worker-<id>-data`. The pause endpoint SHALL NOT delete the PVC.

#### Scenario: Archiving a stateful worker deletes the PVC

- **WHEN** a client calls `PATCH /api/v1/workers/{id}` with `{"state": "archived"}` on a stateful worker
- **THEN** the pod, service, and PVC `jarvis-worker-<id>-data` are all deleted
- **AND** the worker's DB state becomes `archived`

#### Scenario: Deleting a stateful worker deletes the PVC

- **WHEN** a client calls `DELETE /api/v1/workers/{id}` on a stateful worker
- **THEN** the pod, service, and PVC `jarvis-worker-<id>-data` are all deleted
- **AND** the worker row is removed from the database

#### Scenario: Pausing does not delete the PVC

- **WHEN** a stateful worker is paused
- **THEN** the PVC `jarvis-worker-<id>-data` SHALL still exist after the pause completes

### Requirement: Worker entrypoint is idempotent on resume

The `entrypoint.sh` script SHALL detect existing state under `/home/node` and skip initialization steps that would re-do work or overwrite preserved data. Specifically:

1. If `/home/node/jarvis/<repo-name>/.git` exists for a repository in `REPOSITORIES`, the entrypoint SHALL skip `git clone` for that repository.
2. If `/home/node/.claude/skills/<skill-name>/` exists for a skill in `SKILLS`, the entrypoint SHALL skip `arctl skill pull` for that skill.
3. The entrypoint SHALL ensure `/home/node/jarvis` and `/home/node/.claude` exist (creating them if the PVC is empty on first start).
4. ConfigMap-sourced settings (`policy-limits.json`, `remote-settings.json`, `settings.json`, `~/.claude.json`) SHALL be re-copied on every start, overwriting any prior copy in the PVC, so updates from the cluster ConfigMap take effect on resume.
5. `/home/node/.claude/projects/` and `/home/node/.claude/skills/` SHALL never be removed or overwritten by the entrypoint.

#### Scenario: First start with empty PVC

- **WHEN** a stateful worker pod starts for the first time and `/home/node` is empty
- **THEN** the entrypoint creates `/home/node/jarvis` and `/home/node/.claude`
- **AND** clones every repository in `REPOSITORIES`
- **AND** pulls every skill in `SKILLS`
- **AND** writes ConfigMap settings into `/home/node/.claude/`

#### Scenario: Resume with populated PVC skips re-clone

- **WHEN** a stateful worker pod resumes and `/home/node/jarvis/myrepo/.git` already exists for `myrepo` in `REPOSITORIES`
- **THEN** the entrypoint SHALL NOT run `git clone` for `myrepo`
- **AND** the existing working tree (including uncommitted changes) is preserved

#### Scenario: Resume preserves Claude session history

- **WHEN** a stateful worker pod resumes and `/home/node/.claude/projects/-home-node-jarvis/<session-uuid>.jsonl` exists
- **THEN** the entrypoint SHALL NOT delete or overwrite that file
- **AND** the Claude Code process is started with `--resume <session-uuid>` and successfully continues the prior conversation

#### Scenario: Resume re-applies updated ConfigMap settings

- **WHEN** a stateful worker pod resumes after the host ConfigMap `jarvis-claude-config` has been updated
- **THEN** the entrypoint copies the updated ConfigMap files into `/home/node/.claude/` and `/home/node/.claude.json`, replacing the previously persisted versions

### Requirement: PVC sizing and storage class are configurable

The PVC for a stateful worker SHALL be created with `accessModes: [ReadWriteOnce]`, `resources.requests.storage` from `worker.persistence.size` (Helm value, default `2Gi`) and `storageClassName` from `worker.persistence.storageClass` (Helm value, default `standard`). These values are passed to the backend via the `backend-configmap` (env vars `WORKER_PVC_SIZE`, `WORKER_PVC_STORAGE_CLASS`) and applied at PVC creation time.

#### Scenario: Default sizing on Minikube

- **WHEN** the Helm chart is installed without overriding `worker.persistence`
- **THEN** the backend ConfigMap exposes `WORKER_PVC_SIZE=2Gi` and `WORKER_PVC_STORAGE_CLASS=standard`
- **AND** stateful worker PVCs are created with those values

#### Scenario: Custom sizing applied

- **WHEN** the chart is installed with `worker.persistence.size=10Gi` and `worker.persistence.storageClass=fast-ssd`
- **THEN** stateful worker PVCs are created with `resources.requests.storage: 10Gi` and `storageClassName: fast-ssd`

### Requirement: Worker ServiceAccount has RBAC for PVCs

The `jarvis-backend` ServiceAccount used by the backend (and by the K8s service module) SHALL have an RBAC `Role` in the `jarvis` namespace granting `get`, `list`, `create`, and `delete` on `persistentvolumeclaims`. Without these permissions, stateful worker creation SHALL fail with HTTP 503.

#### Scenario: Helm renders the new RBAC verbs

- **WHEN** `helm/jarvis/templates/worker-role.yaml` is rendered
- **THEN** the resulting `Role` includes a rule with `apiGroups: [""]`, `resources: ["persistentvolumeclaims"]`, and `verbs: ["get","list","create","delete"]`

#### Scenario: Stateful worker creation fails cleanly without RBAC

- **WHEN** a client calls `POST /api/v1/workers` with `mode=stateful` against a backend whose ServiceAccount is missing the PVC RBAC
- **THEN** the response SHALL be HTTP 503 with a message indicating that PVC creation failed
- **AND** no orphan pod or service SHALL remain

### Requirement: UI exposes mode badge and pause / resume controls

The Workers page worker card SHALL render a mode badge ("Stateful" or "Ephemeral") and SHALL expose:

- A **Pause** button on stateful workers in state `working` or `waiting_for_human`.
- A **Resume** button on stateful workers in state `paused` or `error`.
- No pause/resume buttons on ephemeral workers.
- A **Mode** selector in the Create Worker overlay (Workers page and Task Board inline create), defaulting to `ephemeral`.

#### Scenario: Stateful worker shows pause button

- **WHEN** the Workers page renders a stateful worker in state `working`
- **THEN** the worker card displays a "Stateful" badge and a Pause button

#### Scenario: Errored stateful worker shows resume button

- **WHEN** the Workers page renders a stateful worker in state `error`
- **THEN** the worker card displays a "Stateful" badge and a Resume button

#### Scenario: Ephemeral worker hides pause/resume

- **WHEN** the Workers page renders an ephemeral worker
- **THEN** the worker card SHALL display an "Ephemeral" badge and SHALL NOT display Pause or Resume buttons

#### Scenario: Create Worker overlay defaults to ephemeral

- **WHEN** the user opens the Create Worker overlay without prior selection
- **THEN** the Mode selector is set to `ephemeral` by default
- **AND** submitting the form without changing the selector creates an ephemeral worker
