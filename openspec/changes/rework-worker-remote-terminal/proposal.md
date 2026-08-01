# Proposal: rework-worker-remote-terminal

## Why

JAW workers currently run Claude Code headless (`--print --input-format stream-json` fed by a FIFO that nothing ever writes to), so the task prompt never reaches the session and the only human access is a VSCode Dev Containers URI that requires a local extension. The doctolib/remote-claude project has proven a better model: Claude runs interactively under a PTY in the pod, and a manager bridges that PTY to a browser terminal over WebSocket. Adopting it fixes the broken prompt injection, gives users a first-class in-app terminal, and removes the deployment couplings (privileged pods, minikube-mount-sourced ArgoCD) that block running JARVIS outside a local cluster.

## What Changes

- **Worker runtime rework** (remote-claude pattern):
  - Worker pods run Claude Code **interactively** as the main container process (`tty: true`, `stdin: true`), replacing the headless stream-json/FIFO launch. **BREAKING** for the worker image contract.
  - The task prompt is injected as the initial interactive input (`TASK_PROMPT` env → `claude "$TASK_PROMPT"`), fixing the unwired `/tmp/claude-input` FIFO.
  - Conversation resume becomes a probe: if `~/.claude/projects/**/*.jsonl` exists, launch with `--resume <latest>`; otherwise start fresh with the prompt (replaces the unconditional `--resume <derived-uuid>` that fails on first boot).
  - The status server moves from a backgrounded entrypoint job to a **dedicated sidecar container**, sharing the Claude state file via an `emptyDir` volume; hooks and status server read/write a shared `STATE_FILE` path instead of `/tmp/claude-state`.
  - Worker pods run **unprivileged when no skills are requested**; privileged mode (needed for the dockerd-based `arctl skill pull`) is applied only when the worker references skills. The vestigial container port 3000/`ui` is removed.
  - Pod creation becomes idempotent (delete-before-create) and worker resources come from Helm values instead of being hardcoded in `k8s.py`.
- **Backend terminal bridge** (new):
  - WebSocket endpoints `WS /api/v1/workers/{id}/terminal` (attach to the Claude PTY, shared ring buffer with replay) and `WS /api/v1/workers/{id}/shell` (per-connection `/bin/bash` exec).
  - Wire protocol matches remote-claude: binary frames carry raw PTY bytes both directions; JSON text frames carry `{type: "resize"}` (client→server) and `{type: "status"}` (server→client).
  - `GET /api/v1/workers/{id}/logs` returns the worker pod's recent log tail for debugging.
- **Frontend remote terminal** (new):
  - xterm.js terminal page for a worker's Claude session and ad-hoc shell, reachable from the Workers page.
  - Worker card actions become Terminal / Shell / VSCode / Logs; the brain-click-opens-VSCode behavior is replaced by an explicit action row.
- **Portable deployment**:
  - `argocd/jarvis-app.yaml` and `argocd/jaar-app.yaml` (the GHCR variants) source the Helm charts from the **Git repository URL** instead of `file:///mnt/jarvis-repo`; the `-local` variants keep the minikube-mount source for the fast inner loop. **BREAKING** for anyone relying on uncommitted chart edits syncing in the GHCR variants.
  - SQLite and worker PVC storage classes are parameterized per environment; the hostPath PV flow remains a local-only option.
  - The minikube mount becomes a local-dev convenience, no longer a structural requirement of the deployment.

## Capabilities

### New Capabilities

- `worker-interactive-runtime`: Interactive Claude Code PTY runtime in worker pods — container tty/stdin, prompt injection, resume probe, status-server sidecar with shared state file, conditional pod privilege, idempotent pod creation, Helm-sourced resources.
- `worker-terminal-bridge`: Backend WebSocket bridge between browser clients and worker pod PTYs — attach fan-out with ring-buffer replay, per-connection shell exec, wire protocol, pod log endpoint, failure-context streaming.
- `worker-terminal-ui`: Browser terminal for workers in the JARVIS frontend — xterm.js session/shell views, worker card action row, connection status handling.

### Modified Capabilities

- `helm-deployment`: The remote (GHCR) ArgoCD Application CRs source from the Git repository instead of the minikube mount; storage classes for SQLite and worker PVCs are per-environment values with hostPath as a local-only option.
- `local-dev-cluster`: `minikube mount` is required only for local-source deployment (`deploy-local`) and the `.data/` hostPath persistence flow; `make deploy` (GHCR variant) works without it.

## Impact

- **Worker image** (`worker/Dockerfile`, `entrypoint.sh`, `setup-claude.sh`, `status-server/index.js`): launch sequence, hook targets, sidecar split. Image must be rebuilt; existing workers must be recreated (state machine and REST API are unchanged).
- **Backend** (`app/services/k8s.py`, new `app/services/terminal.py`, `app/routes/workers.py`): pod spec changes (two containers, tty/stdin, conditional privilege), new WS/log routes. New dependency: none beyond the existing `kubernetes` client (WSClient streams) — FastAPI WebSockets are already available via Starlette.
- **Frontend** (`src/pages/Workers/`, new terminal page, `src/api/client.ts`): new dependencies `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`.
- **Helm/ArgoCD** (`argocd/*.yaml`, `helm/jarvis/values.yaml`, `templates/backend-configmap.yaml`, worker RBAC unchanged): Git-sourced apps, worker resource values plumbed through the backend ConfigMap.
- **Docs**: `CLAUDE.md` worker section (removes the never-implemented per-worker HTTPRoute claims, documents the terminal), `Makefile` help text.
- **Constraints**: terminal attach state lives in backend memory → backend stays single-replica (already required by SQLite). WebSocket upgrades ride the existing `main.jarvis.io` HTTPRoute (Istio handles WS natively) — no per-worker HTTPRoutes.
