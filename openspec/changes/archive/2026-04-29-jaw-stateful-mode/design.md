## Context

JAW workers are spawned by the JARVIS backend (`backend/app/services/k8s.py`) as bare `Pod` objects (one per worker, plus a `ClusterIP` Service for the status endpoint, plus an `HTTPRoute` for the chat UI). Pods are created with `restartPolicy: Never`, no `PersistentVolumeClaim`, and the container's `WORKDIR` is `/home/node/jarvis`. The entrypoint script (`worker/entrypoint.sh`) clones repositories, pulls JAAR skills, copies a Claude config from a ConfigMap, and starts a long-lived Claude Code process via `claude --resume <session-uuid>` whose conversation history is written to `~/.claude/projects/-home-node-jarvis/<uuid>.jsonl`.

That model loses everything — working tree, conversation history, pulled skills — the moment the pod terminates. The user-experience consequence is that any pod failure (OOM, node restart, transient network glitch during boot) or any explicit "I want to take a break" forces a complete worker recreation: re-clone, re-pull skills, lose the entire chat context. For workers that have run for hours and accumulated significant context, this is unacceptable.

This change introduces a **stateful** mode opt-in: the backend provisions a per-worker `PersistentVolumeClaim`, mounts it at `/home/node` (the entire home directory), adds explicit stop/restart endpoints, and makes the worker entrypoint idempotent so restarted pods do not destroy preserved state.

## Goals / Non-Goals

**Goals:**

- Allow workers to survive pod failures, node drains, and explicit stops without losing the cloned working tree or Claude Code session history.
- Provide explicit stop / restart / re-run-on-error operations on workers.
- Keep ephemeral mode the default and unchanged: existing workers and existing tests SHALL not regress.
- Keep the implementation surface small: reuse the existing Pod-based worker creation path, add a single optional volume + mount, and add two new API endpoints.

**Non-Goals:**

- Auto-recovery / self-healing of failed workers. Restart is explicitly user-driven.
- Multi-pod stateful workers (no horizontal scaling — one pod per worker is invariant).
- Cross-cluster portability of worker state (PVCs are bound to a node / storage class; we do not snapshot or migrate them).
- Live snapshots / time-travel debugging of past sessions.
- Backups of worker PVCs to off-cluster storage. Storage retention is governed by the cluster's storage class.
- Mode mutation after creation. `mode` is set once at creation; changing modes requires creating a new worker. The schema enforces this implicitly: `WorkerUpdate` has no `mode` field, so any inbound `mode` is silently dropped by Pydantic and the stored value is unchanged.

## Decisions

### Decision 1: Use a Pod + explicit PVC, not a StatefulSet of 1 replica

**Decision:** stateful workers reuse the existing `Pod`-based path. The backend provisions a separate `PersistentVolumeClaim` named `jarvis-worker-<id>-data` (sibling resource), mounts it at `/home/node`, and explicitly deletes / re-creates the Pod and Service on stop / restart. The PVC is owned by the worker DB row, not by Kubernetes.

**Why not a StatefulSet (1 replica):**

- StatefulSet auto-restarts pods (`restartPolicy: Always` is enforced). For us, pod failure is a deliberate signal — it MUST surface to the user as `error`. With an STS we would have to detect failure ourselves and immediately scale to 0 to "freeze" the worker, which is more code and more racy than just letting the Pod die under `restartPolicy: Never`.
- StatefulSet's `volumeClaimTemplates` couples PVC lifecycle to the STS. Deleting the STS leaves orphan PVCs unless `persistentVolumeClaimRetentionPolicy.whenDeleted: Delete` is set; setting it complicates stop semantics (we don't want stop to delete the PVC). Owning the PVC explicitly is simpler.
- Stop via `kubectl scale sts ... --replicas=0` does work, but restart via `--replicas=1` triggers the same template — meaning we cannot meaningfully change image, env, or skills between stop and restart without a rolling update. Deleting and re-creating a Pod is a clean slate per restart.
- Ephemeral workers stay as Pods. Reusing the same shape (Pod) for both modes — with one branch on whether to attach a PVC — is materially simpler than maintaining two K8s shapes.

**Why not Job + PVC:**

- Job semantics (Active / Succeeded / Failed) almost match what we want, but Jobs come with a `backoffLimit` retry loop we don't need (`backoffLimit: 0` disables it but is awkward), and Jobs don't fit the long-running interactive-session model. Pod with `restartPolicy: Never` is closer to what an "interactive worker" is.

### Decision 2: Mount the PVC at `/home/node` (the whole home directory)

**Decision:** the volume mount path is `/home/node`. This persists `/home/node/jarvis/` (cloned repos + working tree), `/home/node/.claude/` (settings, `projects/<session-uuid>.jsonl`, `skills/<name>/`), and `/home/node/.claude.json` in a single mount.

**Why:**

- A single mount is simpler than two PVCs or a PVC with multiple `subPath` mounts.
- Claude Code sessions live under `~/.claude/projects/`, not under the working directory, so a mount only at `/home/node/jarvis` would not preserve session history without symlink trickery. Mounting the whole home directory eliminates that complexity.
- The home directory is created in the Dockerfile (`mkdir -p /home/node/jarvis /home/node/.claude`) but those directories disappear behind an empty PVC mount on first start; the entrypoint must `mkdir -p` them again. This is cheap.
- Worker scripts (`entrypoint.sh`, `setup-claude.sh`, `status-server/`) live at `/opt/jarvis-worker/`, *outside* `$HOME`, so the PVC mount does not shadow them.

**Trade-offs:**

- ConfigMap-sourced settings (mounted at `/init-claude-config`) must be **copied** into `/home/node/.claude/` on every start, not symlinked. The PVC overlays anything baked into the image. The current entrypoint already copies these files — only the targets change.
- Skills, settings, and conversation history all share a single PVC, so if disk pressure occurs, all three categories share the storage budget. We expose `WORKER_PVC_SIZE` (Helm value, default `2Gi`) so operators can tune.
- The container's UID is 1000 (`node`); the PVC's filesystem must be owned by 1000:1000. We rely primarily on `fsGroup: 1000` on the pod's `securityContext`, but Minikube's `standard` (hostPath) and several other storage classes ignore `fsGroup` — they provision the volume root as `root:root`. As a fallback the entrypoint runs `sudo chown -R node:node /home/node` on first boot when it detects the volume root is not owned by uid 1000. Sudo is already available in the worker image (used by the dockerd-for-skill-pulls flow).

### Decision 3: Stop = delete pod + service, keep PVC. Restart = re-create pod + service.

**Decision:** `POST /api/v1/workers/{id}/stop` deletes the Pod and Service (idempotent) and sets the worker DB state to `stopped`. `POST /api/v1/workers/{id}/restart` deletes any pre-existing Pod + Service first (so a force-restart on a live worker is well-defined) and then creates a new Pod + Service using the same recipe as initial creation (same image, env, repositories, skills) referencing the existing PVC by name. Restart is valid for stateful workers in any state except `archived`.

**Why:**

- The PVC is the durable state; everything else can be regenerated from the worker row.
- We already build the pod spec from the `Worker` model in `routes/workers.py` for `create_worker`. Restart reuses the same builder. The only new bit is "do not provision a PVC if one already exists with this name".
- Keeping the Service intact during stop is tempting but costs nothing to recreate, and recreating it makes the stop/restart code path symmetric.
- Allowing restart from any non-archived state means the user has a single, predictable recovery action regardless of how the worker got into trouble (failed, manually stopped, just done with a previous run, etc.). The UI hides the Restart button when it would be redundant (live pod), but the API itself remains permissive.

**Trade-offs:**

- The worker's IP and gateway routing (`HTTPRoute`) reference the Service by name; deleting and re-creating the Service with the same name is fine because the `HTTPRoute` is already keyed on the Service name. We must verify there is no race window where the `HTTPRoute` references a non-existent Service — Istio and the Gateway API both tolerate this gracefully (responses return 503 until the Service comes back), and the frontend already polls the worker's status, so the user sees the restart happen.
- We do not currently persist the original `WORKER_IMAGE`/skills/repositories on the worker row in a way that survives image-tag changes (e.g., `WORKER_IMAGE=...:latest` resolves to different SHAs over time). A restart after a worker-image bump implicitly upgrades the worker's container. This is an acceptable behaviour (and matches what `kubectl apply` would do); we explicitly call it out in Risks.

### Decision 4: Failure detection and state sync via pod-status polling, not a Kubernetes watch

**Decision:** `GET /api/v1/workers/{id}` synchronizes the persisted DB state with Kubernetes pod reality on every read. The handler calls `k8s.get_pod_phase(worker_id)` and applies these mappings:

- pod missing → DB state set to `stopped`, `pod_status: "missing"`
- pod phase `Failed` (or container `terminated` with non-zero `exitCode`) → DB state set to `error`, `pod_status: "failed"`
- pod phase `Succeeded` → DB state set to `done`, `pod_status: "succeeded"`
- pod phase `Pending`/`Running` → ask the in-pod status server for fine-grained `working`/`waiting_for_human` reports; otherwise expose the raw phase via `pod_status`

**Why:**

- The existing path already polls the status server inside the pod. We piggy-back on the same call. No new infra (no informers, no watches, no separate reconciler).
- Pod failures and external pod deletions are rare relative to status polls. The added `read_namespaced_pod` call is cheap.
- Reflecting pod reality back into the DB lets the UI gate Stop/Restart buttons from a single source (`effective_state`) without needing to call a separate "is the pod alive?" endpoint.

**Trade-offs:**

- The state transition is best-effort and only happens when something queries the worker. If no one looks at a worker for hours after it fails, the DB state lags. Acceptable: the UI polls every 5s, so anyone looking at a worker sees the correct state quickly.
- A future improvement could add a real Kubernetes watch in a backend background task, but it is out of scope.

### Decision 5: Idempotent entrypoint, ConfigMap settings always re-applied

**Decision:** the entrypoint guards every initialization step with a "does this exist already?" check, except for the ConfigMap-sourced files which are unconditionally copied on every start. On stateful starts it also runs `sudo chown -R node:node $HOME` if the volume root is not owned by uid 1000 — this is the fallback for storage classes that ignore `fsGroup`.

**Why:**

- Persisted state (cloned repos, pulled skills, `~/.claude/projects/`) belongs to the worker. Re-doing the work on restart would be slow and could destroy uncommitted edits or live session JSONL files that Claude is appending to.
- ConfigMap files (`settings.json`, `policy-limits.json`, etc.) are managed by the cluster operator and may have changed since the worker was created. Reapplying them on every start lets us push policy changes without recreating workers.

**Trade-offs:**

- If a user has manually edited `~/.claude/settings.json` inside a stateful worker, those edits are overwritten on restart. Acceptable; settings are operator-managed.

### Decision 6: Mode is immutable

**Decision:** `mode` is set on `POST /api/v1/workers` and cannot be changed via `PATCH`. Switching from ephemeral to stateful mid-life would have to migrate data out of the container into a new PVC; switching from stateful to ephemeral would orphan or destroy the PVC. Both are doable but add complexity not justified by the use case.

**Implementation note:** `WorkerUpdate` has no `mode` field, so Pydantic silently drops any inbound `mode` and the persisted value is left untouched. We don't return an HTTP 4xx for the unknown field; clients that send `mode` in a `PATCH` will get a successful response with the *unchanged* mode. That is the intended behavior — the field is treated as inert.

**Why:**

- We never expect a user to want to "convert" a running worker. They either want stateful from the start (long-running session) or accept ephemeral (one-shot).

## Risks / Trade-offs

- **[Risk] Image tag drift during restart** → restarting a stateful worker re-creates the pod from `WORKER_IMAGE` (env var, default `ghcr.io/alchemesh-io/jarvis-worker:latest`). If the tag has moved, the worker silently upgrades. **Mitigation:** document this; recommend pinning to a digest in production. The same mechanism applies to ephemeral workers today, so this is not a regression.
- **[Risk] PVC orphaning on backend crashes between Pod creation and DB commit** → if the backend creates the PVC then crashes before persisting the worker row, the PVC leaks. **Mitigation:** PVC creation happens after DB flush of the worker row. The existing pod-creation flow already has the same window for pod/service orphans; no new exposure.
- **[Risk] PVC quota / storage pressure** → many stateful workers, especially long-running ones, can fill the cluster's storage class. **Mitigation:** size limit per PVC via Helm (`worker.persistence.size`, default `2Gi`); operator monitors quotas; archive workflow deletes PVCs.
- **[Risk] `fsGroup` not honored by some storage classes** → some storage classes (e.g., Minikube hostPath, NFS) ignore `fsGroup` and leave the PVC root owned by `root:root`, breaking writes from uid 1000. **Mitigation:** the entrypoint runs `sudo chown -R node:node $HOME` on first boot when it detects this. Documented in `helm/jarvis/values.yaml` comments.
- **[Risk] Restart race with HTTPRoute / Service** → tearing down and re-creating the Service may leave the `HTTPRoute` momentarily pointing at a missing backend. **Mitigation:** transient 503s are acceptable; the frontend already retries; the gap is < 1 second in practice.
- **[Risk] Stateful workers accumulate disk over time** → `git pull`, `npm install`, etc. inside `/home/node/jarvis` grow the PVC. **Mitigation:** out of scope; users can manually delete and recreate workers; future work could add a "reset workspace" action.
- **[Risk] Concurrent restart on the same PVC** → `ReadWriteOnce` would block a second pod; if a stale stopped pod has not finished terminating, the new pod stays `Pending`. **Mitigation:** the stop endpoint waits for pod deletion (or marks the worker `stopped` only after `delete_namespaced_pod` returns); the restart endpoint deletes pod+service before creating new ones, but if termination is slow the new pod will sit `Pending` until the volume is released.
- **[Trade-off] We persist `~/.claude/`, including `~/.claude/skills/`** → this means the JAAR skill registry effectively becomes unauthoritative for stateful workers (we won't re-pull). This is intentional (avoid clobbering skill edits, keep restart fast) and lives in the modified `skill-worker-integration` spec.

## Migration Plan

1. **Backend & worker code shipped together** (single PR / single Helm release):
   - Alembic migration: add `mode` column with default `ephemeral`; expand `worker_state` enum to include `stopped` and `error`. Existing rows are unaffected.
   - Roll out the new backend and worker images. Existing workers (if any) are ephemeral by default and behave identically.
2. **Helm chart bump**:
   - `helm/jarvis/values.yaml`: new `worker.persistence` block.
   - `helm/jarvis/templates/worker-role.yaml`: new RBAC verbs for `persistentvolumeclaims`. ArgoCD sync applies them.
   - `helm/jarvis/templates/backend-configmap.yaml`: new env vars `WORKER_PVC_SIZE`, `WORKER_PVC_STORAGE_CLASS`.
3. **Rollback**:
   - The `mode` column and the new enum values are additive; rollback to the previous backend leaves them unused (the older code never reads `mode` and never writes `stopped`/`error`). No data migration is required to roll back.
   - Stateful workers created before rollback would lose their stop/restart affordances on the older backend, but their PVCs remain (we don't delete them on rollback). After rollback, the old `DELETE` handler does not delete PVCs; an operator may need to clean them up manually.
4. **Validation**:
   - On a Minikube cluster, create a stateful worker, verify the PVC is bound, write a marker file in `/home/node/jarvis/.marker`, stop, restart, verify the marker is preserved and the worker pod sees the same Claude session UUID.
   - Verify ephemeral worker creation, stop attempt (rejected with HTTP 409), and delete (no PVC created or deleted).

## Open Questions

- **Should stop forcibly terminate the Claude process gracefully?** We currently rely on `kubectl delete pod` triggering SIGTERM with the default `terminationGracePeriodSeconds` (30s). Claude Code is not designed for graceful shutdown; the JSONL file might be left mid-write. We assume the JSONL is self-healing across restarts (the next `--resume` ignores the trailing partial line). Validate this empirically during implementation.
- **Should the backend reject stop if the worker has uncommitted git changes?** Probably not — the entire point is to preserve them. But we may want a UI hint.
- **Should restart re-issue `git pull` for repositories whose remote has new commits?** No, by default. But a "Sync repos" button on the worker card may be useful future work.
