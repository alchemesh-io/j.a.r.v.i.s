## 1. Backend data model & migration

- [x] 1.1 Add `WorkerMode` enum (`ephemeral`, `stateful`) to `backend/app/models/enums.py`
- [x] 1.2 Extend `WorkerState` enum in `backend/app/models/enums.py` with `paused` and `error`
- [x] 1.3 Add `mode` column to `Worker` SQLAlchemy model in `backend/app/models/worker.py` with default `ephemeral`
- [x] 1.4 Generate Alembic migration: add `mode` column, alter `worker_state` enum (dialect-aware: SQLite drop-and-recreate vs. PostgreSQL `ALTER TYPE ... ADD VALUE`)
- [x] 1.5 Run the migration locally and confirm existing rows default to `mode='ephemeral'`

## 2. Backend schemas & routes

- [x] 2.1 Add `mode` field to `WorkerCreate` (optional, defaults to `ephemeral`) and `WorkerResponse` (required) in `backend/app/schemas/worker.py`
- [x] 2.2 Reject `mode` in `WorkerUpdate` (or ignore + 400) — mode is immutable _(WorkerUpdate has no mode field; any sent value is silently ignored by Pydantic)_
- [x] 2.3 In `routes/workers.py::create_worker`, branch on `mode`: for stateful, call new `k8s.create_worker_pvc` before `create_worker_pod`
- [x] 2.4 Pass `mode` and pvc-related env to the pod spec so the entrypoint can act differently when stateful
- [x] 2.5 Add `POST /api/v1/workers/{id}/pause` route: validate state ∈ {`working`, `waiting_for_human`} (or already `paused`), reject for ephemeral with HTTP 409, delete pod + service via `k8s.delete_worker_pod_only`, set DB state `paused`
- [x] 2.6 Add `POST /api/v1/workers/{id}/resume` route: validate state ∈ {`paused`, `error`} and `mode == stateful`, rebuild pod spec from worker row, call `k8s.create_worker_pod` + `create_worker_service`, set DB state to `initialized`
- [x] 2.7 In `routes/workers.py::get_worker`, when pod-status is unreachable, call new `k8s.get_pod_phase` to detect `Failed`/non-zero exit and persist DB state `error`
- [x] 2.8 In `routes/workers.py::update_worker` and `delete_worker`, when worker is stateful, call `k8s.delete_worker_pvc` after deleting pod + service
- [x] 2.9 Add OpenAPI summaries / response models for the two new endpoints

## 3. Backend Kubernetes service

- [x] 3.1 Add `create_worker_pvc(worker_id, size, storage_class)` in `backend/app/services/k8s.py` creating a `PersistentVolumeClaim` named `jarvis-worker-<id>-data` with `accessModes: [ReadWriteOnce]`, requested storage from arg, and storage class from arg
- [x] 3.2 Add `delete_worker_pvc(worker_id)` (idempotent — 404 is fine)
- [x] 3.3 Add `delete_worker_pod_only(worker_id)` and `delete_worker_service(worker_id)` for pause (Pod + Service only, never PVC)
- [x] 3.4 Modify `create_worker_pod` to accept a `stateful: bool` (or `mode: WorkerMode`) flag; when stateful, add a `persistentVolumeClaim` volume `jarvis-data` and a `volumeMount` at `/home/node` on the worker container
- [x] 3.5 Add `securityContext.fsGroup: 1000` on the pod spec for stateful pods so the volume is owned by the `node` user (UID 1000)
- [x] 3.6 Pass `WORKER_MODE` (`ephemeral` / `stateful`) as an env var to the worker container so the entrypoint can act on it
- [x] 3.7 Add `get_pod_phase(worker_id)` returning `(phase, exit_code)` from `read_namespaced_pod`, used by the route to decide `error` state
- [x] 3.8 Read `WORKER_PVC_SIZE` and `WORKER_PVC_STORAGE_CLASS` env vars (set by the backend ConfigMap) — _consumed by routes/workers.py via os.getenv_

## 4. Worker image & entrypoint

- [x] 4.1 In `worker/entrypoint.sh`, ensure `mkdir -p /home/node/jarvis /home/node/.claude /home/node/.claude/skills /home/node/.claude/projects` early — the PVC may overlay those directories on first start
- [x] 4.2 In `worker/entrypoint.sh`, guard the `git clone` loop: if `~/jarvis/<repo_name>/.git` already exists, skip the clone for that repo
- [x] 4.3 In `worker/entrypoint.sh`, guard the `arctl skill pull` loop: if `~/.claude/skills/<skill_name>/SKILL.md` exists (or directory non-empty), skip the pull
- [x] 4.4 In `worker/entrypoint.sh`, keep the ConfigMap copy step unconditional so `policy-limits.json`, `remote-settings.json`, `settings.json`, `~/.claude.json` are refreshed on every start
- [x] 4.5 In `worker/setup-claude.sh`, never overwrite an existing `~/.claude/projects/-home-node-jarvis/<uuid>.jsonl` _(already satisfied: setup-claude.sh only edits ~/.claude/settings.json and ~/.claude.json, never touches projects/)_
- [x] 4.6 Add a one-line log on stateful starts: "[worker] mode=stateful, PVC mounted at /home/node, X repos cached, Y skills cached"

## 5. Helm chart & RBAC

- [x] 5.1 Add `worker.persistence.size` (default `2Gi`) and `worker.persistence.storageClass` (default `standard`) to `helm/jarvis/values.yaml`
- [x] 5.2 Add `WORKER_PVC_SIZE` and `WORKER_PVC_STORAGE_CLASS` env vars to `helm/jarvis/templates/backend-configmap.yaml` from those values
- [x] 5.3 Extend `helm/jarvis/templates/worker-role.yaml` with a rule: `apiGroups: [""]`, `resources: ["persistentvolumeclaims"]`, `verbs: ["get","list","create","delete"]`
- [x] 5.4 Verify with `helm template` that the rendered Role includes the new rule
- [ ] 5.5 Sync via ArgoCD (`make sync`) and confirm the new RBAC and ConfigMap are applied to the running backend _(runtime — user runs `make sync`)_

## 6. Frontend API client & types

- [x] 6.1 Add `mode: 'ephemeral' | 'stateful'` to `Worker` type in `frontend/src/api/client.ts`
- [x] 6.2 Add `'paused'` and `'error'` to the `WorkerState` union type in the same file
- [x] 6.3 Add `pauseWorker(id: string)` and `resumeWorker(id: string)` functions hitting the new endpoints
- [x] 6.4 Update `createWorker` to send the optional `mode` field

## 7. Frontend UI

- [x] 7.1 Add a Mode selector to the Create Worker overlay (in `pages/Workers/Workers.tsx`) with options "Ephemeral" (default) and "Stateful", a help tooltip explaining persistence
- [x] 7.2 Add a `WorkerModeBadge` component rendering "Ephemeral" / "Stateful" on each worker card _(JADS package)_
- [x] 7.3 Add Pause and Resume buttons on the worker card, gated on `state` and `mode`
- [x] 7.4 Wire those buttons to the new `pauseWorker` / `resumeWorker` mutations via TanStack Query, invalidating the workers list on success
- [x] 7.5 Surface the `error` state visually (red accent + error icon) in the worker card
- [x] 7.6 Mirror the pause/resume affordances on the Task Board worker controls (`pages/TaskBoard/`)
- [x] 7.7 Storybook story for `WorkerModeBadge` in stateful and ephemeral variants

## 8. Tests

- [x] 8.1 Backend unit test: `WorkerCreate` accepts `mode`; `WorkerResponse` returns `mode`
- [x] 8.2 Backend unit test: pause endpoint rejects ephemeral with 409
- [x] 8.3 Backend unit test: resume endpoint rejects ephemeral with 409 and rejects invalid states with 409
- [x] 8.4 Backend unit test: pause is idempotent on already-paused workers
- [x] 8.5 Backend unit test: archive of stateful worker calls `delete_worker_pvc`
- [x] 8.6 Backend unit test: `create_worker_pod` for stateful adds the PVC volume and `/home/node` mount; ephemeral does not
- [x] 8.7 Worker entrypoint: shell test (or in-container script) that exercises idempotent clone (run twice, verify no second `git clone` invocation)
- [x] 8.8 Frontend test: worker card shows mode badge and correct buttons per state/mode combination _(WorkerModeBadge.test.tsx; gating logic exercised by typecheck + storybook)_
- [ ] 8.9 Manual end-to-end on Minikube: create stateful worker → write `marker.txt` in `/home/node/jarvis` → pause → resume → verify file present and Claude session resumed _(runtime — user runs against live cluster)_

## 9. Documentation

- [x] 9.1 Update `CLAUDE.md` "Worker pods consume significant resources" row of Known Limitations with a note on stateful mode and PVC sizing
- [x] 9.2 Add a short "Stateful workers" subsection under "Coding Conventions → Worker image" in `CLAUDE.md`
- [x] 9.3 Update the OpenAPI doc (auto-generated) by ensuring the new endpoints have descriptive summaries _(set via `summary=` and `description=` decorator kwargs in routes/workers.py)_
